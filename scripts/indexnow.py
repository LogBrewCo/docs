#!/usr/bin/env python3
"""Tell IndexNow search engines which docs.logbrew.co pages changed.

The IndexNow workflow runs this script after a new version of docs.logbrew.co goes
live. It compares the pages of that version with the version that was live before
it and sends IndexNow (Bing, Yandex, and other engines) the URLs of the pages that
were added, changed, renamed, or removed. When the earlier version did not have
the key file yet, it sends every URL in the sitemap. The key file is the file
<key>.json at the repository root, which holds only <key> as plain text. The site
serves .json files from the repository root as they are, so engines read the key at
https://docs.logbrew.co/<key>.json.

The workflow sets GITHUB_REPOSITORY, GITHUB_TOKEN, DEPLOYMENT_ID,
DEPLOYMENT_SHA, and DEPLOYMENT_ENVIRONMENT. IndexNow accepts a list with a 200 or
202 answer. A 429 or 5xx answer, or a network error, gets 3 tries in all. The
result goes to the job summary, and the script exits 0 whatever IndexNow answers,
because the new pages are already live.
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HOST = "docs.logbrew.co"
KEY_NAME = re.compile(r"[A-Za-z0-9-]{8,128}")
ENDPOINT = "https://api.indexnow.org/indexnow"
MAX_URLS = 10_000
ATTEMPTS = 3
WAITS = (10, 30)
MAX_WAIT = 60
LIVE_CHECKS = 10
LIVE_WAIT = 30
ROOT = Path(__file__).resolve().parent.parent


def find_key(root=ROOT):
    """Return the key of the root file <key>.json that holds only <key>, or None."""
    for path in sorted(root.glob("*.json")):
        if KEY_NAME.fullmatch(path.stem) and path.read_text(encoding="utf-8").strip() == path.stem:
            return path.stem
    return None


def page_url(path):
    """Return the URL of a page file, or None for a file that is not a page."""
    if not path.endswith(".mdx"):
        return None
    return f"https://{HOST}/{path[: -len('.mdx')]}"


def changed_pages(diff, sitemap):
    """Return the URLs to send for `git diff --name-status -M` output.

    Added and changed pages count when the live sitemap lists them. Removed pages
    and the old path of a renamed page always count, so engines learn they moved.
    """
    urls = []
    for line in diff.splitlines():
        status, *paths = line.split("\t")
        if not paths:
            continue
        kind = status[:1]
        if kind == "D" or (kind == "R" and len(paths) == 2):
            gone = page_url(paths[0])
            if gone:
                urls.append(gone)
        if kind != "D":
            url = page_url(paths[-1])
            if url and url in sitemap:
                urls.append(url)
    return list(dict.fromkeys(urls))


def sitemap_urls(xml):
    """Return the URLs of this site that the sitemap lists, in order."""
    locs = (part.split("</loc>", 1)[0].strip() for part in xml.split("<loc>")[1:])
    urls = (loc.replace("&amp;", "&") for loc in locs)
    return list(dict.fromkeys(url for url in urls if url.startswith(f"https://{HOST}/")))


def build_requests(urls, key):
    """Return the IndexNow request bodies, at most MAX_URLS URLs each."""
    return [
        json.dumps({
            "host": HOST,
            "key": key,
            "keyLocation": f"https://{HOST}/{key}.json",
            "urlList": urls[start:start + MAX_URLS],
        }).encode()
        for start in range(0, len(urls), MAX_URLS)
    ]


def submit(body, post, sleep):
    """Post one request and return (accepted, status, attempts, detail)."""
    attempt = 0
    while True:
        attempt += 1
        status, retry_after, detail = post(body)
        if status in (200, 202):
            return True, status, attempt, ""
        retryable = status in (0, 429) or status >= 500
        if not retryable or attempt == ATTEMPTS:
            return False, status, attempt, detail
        if retry_after.isdigit():
            sleep(min(int(retry_after), MAX_WAIT))
        else:
            sleep(WAITS[min(attempt - 1, len(WAITS) - 1)])


def post_indexnow(body):
    """Send one request to IndexNow; return (status, Retry-After, detail)."""
    request = urllib.request.Request(
        ENDPOINT, data=body,
        headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, "", ""
    except urllib.error.HTTPError as error:
        text = " ".join(error.read(200).decode(errors="replace").split())
        return error.code, error.headers.get("Retry-After") or "", text
    except OSError as error:
        return 0, "", str(error)


def get(url, token=None):
    """Return (status, body) for a GET request."""
    headers = {"User-Agent": "logbrew-docs-indexnow"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers["Accept"] = "application/vnd.github+json"
    try:
        with urllib.request.urlopen(
                urllib.request.Request(url, headers=headers), timeout=30) as response:
            return response.status, response.read().decode(errors="replace")
    except urllib.error.HTTPError as error:
        return error.code, ""
    except OSError:
        return 0, ""


def previous_live_sha(fetch_json, repository, deployment_id, environment):
    """Return the commit of the last version that went live before this one."""
    deployments = fetch_json(
        f"/repos/{repository}/deployments?environment={environment}&ref=main&per_page=50")
    for deployment in deployments or []:
        if deployment["id"] >= deployment_id:
            continue
        statuses = fetch_json(
            f"/repos/{repository}/deployments/{deployment['id']}/statuses?per_page=20")
        if any(status["state"] == "success" for status in statuses or []):
            return deployment["sha"]
    return None


def git(*args):
    """Run git in the repository and return (exit code, output)."""
    done = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                          check=False)
    return done.returncode, done.stdout


def wait_until_live(fetch, sleep, expected, key):
    """Wait until the key file and the expected pages are live; return the sitemap."""
    sitemap = []
    for check in range(LIVE_CHECKS):
        if check:
            sleep(LIVE_WAIT)
        key_status, key_body = fetch(f"https://{HOST}/{key}.json")
        if key_status != 200 or key_body.strip() != key:
            continue
        map_status, xml = fetch(f"https://{HOST}/sitemap.xml")
        sitemap = sitemap_urls(xml) if map_status == 200 else []
        if sitemap and expected <= set(sitemap):
            return sitemap, True
    return sitemap, False


def select(previous, current, sitemap, key):
    """Return the URLs to send: all of the sitemap on the first run, else the changes."""
    if previous is None or git("cat-file", "-e", f"{previous}:{key}.json")[0] != 0:
        return list(sitemap), "every sitemap URL (first run)"
    code, diff = git("diff", "--name-status", "-M", previous, current, "--")
    if code != 0:
        return list(sitemap), f"every sitemap URL ({previous[:12]} is not in this history)"
    return changed_pages(diff, set(sitemap)), f"pages changed since {previous[:12]}"


def expected_pages(previous, current):
    """Return the page URLs that this version adds or changes."""
    if previous is None:
        return set()
    code, diff = git("diff", "--name-status", "--diff-filter=AMRC", "-M", previous,
                     current, "--")
    if code != 0:
        return set()
    return {page_url(line.split("\t")[-1]) for line in diff.splitlines()} - {None}


def report(text, warning=False):
    """Print the result and add it to the job summary."""
    print(f"::warning::{text}" if warning else text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write(f"IndexNow: {text}\n")


def main():
    repository = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GITHUB_TOKEN"]
    current = os.environ["DEPLOYMENT_SHA"]
    key = find_key()
    if not key:
        report("skipped: the repository has no key file", warning=True)
        return 0

    def fetch_json(path):
        status, body = get(f"https://api.github.com{path}", token)
        return json.loads(body) if status == 200 else None

    previous = previous_live_sha(fetch_json, repository, int(os.environ["DEPLOYMENT_ID"]),
                                 os.environ["DEPLOYMENT_ENVIRONMENT"])
    sitemap, live = wait_until_live(get, time.sleep, expected_pages(previous, current), key)
    if not sitemap:
        report(f"skipped: https://{HOST}/{key}.json or the sitemap is not live", warning=True)
        return 0
    if not live:
        print("Some changed pages are not in the sitemap yet; sending the ones that are.")
    urls, scope = select(previous, current, sitemap, key)
    if not urls:
        report(f"nothing to send: no page changed ({scope})")
        return 0
    for body in build_requests(urls, key):
        accepted, status, attempts, detail = submit(body, post_indexnow, time.sleep)
        if not accepted:
            report(f"HTTP {status} after {attempts} tries for {len(urls)} URLs: {detail}",
                   warning=True)
            return 0
    report(f"HTTP {status} accepted {len(urls)} URLs, {scope}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
