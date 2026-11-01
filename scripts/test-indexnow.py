#!/usr/bin/env python3
"""Test the page selection, request bodies, and retries of scripts/indexnow.py."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "indexnow", Path(__file__).resolve().parent / "indexnow.py")
indexnow = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(indexnow)

SITE = "https://docs.logbrew.co"
KEY = "example-indexnow-key"


class KeyFileTest(unittest.TestCase):
    def test_repository_has_a_key_file(self):
        key = indexnow.find_key()
        self.assertIsNotNone(key)
        self.assertRegex(key, r"^[A-Za-z0-9-]{8,128}$")

    def test_key_file_is_the_root_txt_file_that_holds_its_own_name(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertIsNone(indexnow.find_key(root))
            (root / "notes.txt").write_text("notes\n", encoding="utf-8")
            (root / "short.txt").write_text("short\n", encoding="utf-8")
            (root / "example-other-key.txt").write_text("different\n", encoding="utf-8")
            self.assertIsNone(indexnow.find_key(root))
            (root / f"{KEY}.txt").write_text(f"{KEY}\n", encoding="utf-8")
            self.assertEqual(indexnow.find_key(root), KEY)


class SelectionTest(unittest.TestCase):
    def test_page_url_maps_page_files_only(self):
        self.assertEqual(indexnow.page_url("guides/ai-agents.mdx"), f"{SITE}/guides/ai-agents")
        self.assertEqual(indexnow.page_url("de/introduction.mdx"), f"{SITE}/de/introduction")
        for path in ("docs.json", "README.md", "style.css", "logo/logbrew.svg"):
            self.assertIsNone(indexnow.page_url(path))

    def test_changed_pages(self):
        sitemap = {f"{SITE}/quickstart", f"{SITE}/guides/new", f"{SITE}/de/guides/moved"}
        diff = "\n".join([
            "M\tquickstart.mdx",
            "A\tguides/new.mdx",
            "A\tguides/unlisted.mdx",
            "D\tguides/old.mdx",
            "R095\tguides/moved.mdx\tde/guides/moved.mdx",
            "M\tdocs.json",
            "M\tquickstart.mdx",
        ])
        self.assertEqual(indexnow.changed_pages(diff, sitemap), [
            f"{SITE}/quickstart",
            f"{SITE}/guides/new",
            f"{SITE}/guides/old",
            f"{SITE}/guides/moved",
            f"{SITE}/de/guides/moved",
        ])

    def test_no_page_changed(self):
        self.assertEqual(indexnow.changed_pages("M\tdocs.json\nM\tstyle.css", set()), [])

    def test_sitemap_urls(self):
        xml = (
            "<urlset><url>\n  <loc>https://docs.logbrew.co/introduction</loc>\n</url>"
            "<url><loc>https://docs.logbrew.co/a?x=1&amp;y=2</loc></url>"
            "<url><loc>https://logbrew.co/en</loc></url>"
            "<url><loc>https://docs.logbrew.co/introduction</loc></url></urlset>"
        )
        self.assertEqual(indexnow.sitemap_urls(xml),
                         [f"{SITE}/introduction", f"{SITE}/a?x=1&y=2"])


class RequestTest(unittest.TestCase):
    def test_body(self):
        [body] = indexnow.build_requests([f"{SITE}/quickstart"], KEY)
        self.assertEqual(json.loads(body), {
            "host": "docs.logbrew.co",
            "key": KEY,
            "keyLocation": f"{SITE}/{KEY}.txt",
            "urlList": [f"{SITE}/quickstart"],
        })

    def test_at_most_10000_urls_per_request(self):
        urls = [f"{SITE}/p{n}" for n in range(indexnow.MAX_URLS + 1)]
        sizes = [len(json.loads(body)["urlList"]) for body in indexnow.build_requests(urls, KEY)]
        self.assertEqual(sizes, [10_000, 1])


def run_submit(*replies):
    replies, waits, bodies = list(replies), [], []

    def post(body):
        bodies.append(body)
        return replies.pop(0)

    return indexnow.submit(b"{}", post, waits.append), waits, len(bodies)


class SubmitTest(unittest.TestCase):
    def test_200_and_202_are_accepted(self):
        for status in (200, 202):
            self.assertEqual(run_submit((status, "", "")), ((True, status, 1, ""), [], 1))

    def test_429_5xx_and_network_errors_are_tried_3_times(self):
        result = run_submit((429, "5", ""), (0, "", "timed out"), (202, "", ""))
        self.assertEqual(result, ((True, 202, 3, ""), [5, 30], 3))
        result = run_submit((429, "3600", ""), (200, "", ""))
        self.assertEqual(result, ((True, 200, 2, ""), [60], 2))
        result = run_submit((500, "", ""), (503, "", ""), (502, "", "down"))
        self.assertEqual(result, ((False, 502, 3, "down"), [10, 30], 3))

    def test_other_answers_are_not_tried_again(self):
        for status in (400, 403, 422):
            self.assertEqual(run_submit((status, "", "no")), ((False, status, 1, "no"), [], 1))


class LiveTest(unittest.TestCase):
    def site(self, answers):
        calls = []

        def fetch(url):
            calls.append(url)
            return answers[url].pop(0) if len(answers[url]) > 1 else answers[url][0]

        return fetch, calls

    def test_waits_for_the_key_file_and_new_pages(self):
        key_url = f"{SITE}/{KEY}.txt"
        old = "<loc>https://docs.logbrew.co/quickstart</loc>"
        fetch, _ = self.site({
            key_url: [(404, ""), (200, KEY + "\n")],
            f"{SITE}/sitemap.xml": [(200, old), (200, old + old.replace("quickstart", "new"))],
        })
        waits = []
        sitemap, live = indexnow.wait_until_live(fetch, waits.append, {f"{SITE}/new"}, KEY)
        self.assertEqual((sitemap, live), ([f"{SITE}/quickstart", f"{SITE}/new"], True))
        self.assertEqual(waits, [30, 30])

    def test_gives_up_after_bounded_checks(self):
        fetch, calls = self.site({f"{SITE}/{KEY}.txt": [(404, "")]})
        waits = []
        self.assertEqual(indexnow.wait_until_live(fetch, waits.append, set(), KEY), ([], False))
        self.assertEqual((len(calls), len(waits)), (indexnow.LIVE_CHECKS, indexnow.LIVE_CHECKS - 1))


class PreviousVersionTest(unittest.TestCase):
    def test_last_successful_earlier_deployment(self):
        api = {
            "/repos/o/r/deployments?environment=env&ref=main&per_page=50": [
                {"id": 9, "sha": "later"}, {"id": 7, "sha": "current"},
                {"id": 6, "sha": "failed"}, {"id": 5, "sha": "live"}, {"id": 4, "sha": "older"},
            ],
            "/repos/o/r/deployments/6/statuses?per_page=20": [{"state": "failure"}],
            "/repos/o/r/deployments/5/statuses?per_page=20": [
                {"state": "success"}, {"state": "in_progress"}],
        }
        self.assertEqual(indexnow.previous_live_sha(api.get, "o/r", 7, "env"), "live")

    def test_none_when_nothing_went_live_before(self):
        api = {"/repos/o/r/deployments?environment=env&ref=main&per_page=50": [{"id": 7}]}
        self.assertIsNone(indexnow.previous_live_sha(api.get, "o/r", 7, "env"))
        self.assertIsNone(indexnow.previous_live_sha({}.get, "o/r", 7, "env"))


class WorkflowTest(unittest.TestCase):
    def test_ping_runs_only_after_a_live_main_version(self):
        workflow = (indexnow.ROOT / ".github/workflows/indexnow.yml").read_text(encoding="utf-8")
        for condition in (
            "github.event_name == 'deployment_status'",
            "github.event.deployment_status.state == 'success'",
            "github.event.deployment.ref == 'main'",
            "github.event.deployment_status.environment_url == 'https://docs.logbrew.co'",
        ):
            self.assertIn(condition, workflow)


if __name__ == "__main__":
    unittest.main()
