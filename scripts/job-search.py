#!/usr/bin/env python3.11
"""
Job Hunter — Job Search Script
Uses JobSpy directly to search Indeed, LinkedIn, Glassdoor
Install: pip3.11 install jobspy
Run:     python3.11 scripts/job-search.py
"""

import sys
from datetime import datetime
from pathlib import Path

try:
    from jobspy import scrape_jobs
    import pandas as pd
except ImportError:
    print("ERROR: Run: pip3.11 install jobspy")
    sys.exit(1)

criteria_path = Path("inputs/job-search-criteria.md")
if not criteria_path.exists():
    print("ERROR: Fill in inputs/job-search-criteria.md first")
    sys.exit(1)

def parse_criteria(text):
    c = {"roles": [], "locations": [], "exclude": [], "hours_old": 168, "results_wanted": 20}
    section = None
    for line in text.splitlines():
        line = line.strip()
        if "## Role Titles" in line: section = "roles"
        elif "## Locations" in line: section = "locations"
        elif "## Exclude" in line: section = "exclude"
        elif "## Date Posted" in line: section = "date"
        elif line.startswith("##"): section = None
        elif line and not line.startswith("#") and not line.startswith("<!--"):
            if section == "roles": c["roles"].append(line)
            elif section == "locations": c["locations"].append(line)
            elif section == "exclude": c["exclude"].append(line.lower())
            elif section == "date" and line.isdigit(): c["hours_old"] = int(line) * 24
    return c

criteria = parse_criteria(criteria_path.read_text())

if not criteria["roles"]:
    print("ERROR: Add role titles to inputs/job-search-criteria.md")
    sys.exit(1)

location = criteria["locations"][0] if criteria["locations"] else "Remote"
print(f"\nJob Hunter — Searching\n{'─'*50}")
print(f"Roles:    {', '.join(criteria['roles'])}")
print(f"Location: {location}\n")

all_jobs = []
for role in criteria["roles"]:
    print(f"Searching: {role}...")
    try:
        jobs = scrape_jobs(
            site_name=["indeed", "linkedin", "glassdoor"],
            search_term=role,
            location=location,
            results_wanted=criteria["results_wanted"],
            hours_old=criteria["hours_old"],
            country_indeed="USA"
        )
        if jobs is not None and len(jobs) > 0:
            all_jobs.append(jobs)
            print(f"  Found {len(jobs)} results")
        else:
            print(f"  No results")
    except Exception as e:
        print(f"  Error: {e}")

if not all_jobs:
    print("\nNo jobs found. Try broadening your search criteria.")
    sys.exit(0)

combined = pd.concat(all_jobs, ignore_index=True)
combined = combined.drop_duplicates(subset=["title", "company"], keep="first")

if criteria["exclude"]:
    def not_excluded(row):
        text = f"{str(row.get('title',''))} {str(row.get('description',''))}".lower()
        return not any(kw in text for kw in criteria["exclude"])
    combined = combined[combined.apply(not_excluded, axis=1)]

print(f"\nTotal after filtering: {len(combined)} jobs")

output_path = Path("outputs/job-shortlist.md")
output_path.parent.mkdir(exist_ok=True)

lines = [
    "# Job Search Results",
    f"Searched: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
    f"Roles: {', '.join(criteria['roles'])}",
    f"Location: {location}",
    f"Total: {len(combined)}",
    "", "─"*50, ""
]

for i, (_, job) in enumerate(combined.iterrows(), 1):
    salary = job.get("min_amount")
    salary_str = f"${salary:,.0f}+" if salary and str(salary) not in ("nan","None") else "Not listed"
    lines += [
        f"## {i}. {job.get('title','Unknown')} — {job.get('company','Unknown')}",
        f"Location: {job.get('location','Unknown')}",
        f"Posted:   {job.get('date_posted','Unknown')}",
        f"Source:   {job.get('site','Unknown')}",
        f"Salary:   {salary_str}",
        f"URL:      {job.get('job_url','')}",
        "",
        "To apply: copy URL into inputs/job-description.md then run:",
        "`npm run ats && npm run resume && npm run cover-letter`",
        "", "─"*50, ""
    ]

output_path.write_text("\n".join(lines))
print(f"\nSaved to outputs/job-shortlist.md")
print(f"Top result: {combined.iloc[0].get('title')} at {combined.iloc[0].get('company')}")
