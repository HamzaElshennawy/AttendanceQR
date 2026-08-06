# Database

The schema is the source of truth for deploys, rollbacks, and code review. It lives here,
in version control — `*.sql` is deliberately not gitignored.

## ⚠️ The baseline migration is missing

`migrations/` currently contains only the forward migration added alongside the billing
rewrite. The **baseline** — every table, index, trigger, and RLS policy created before that
point — still exists only inside the hosted Supabase project and has never been committed.

Until it is, there is no reproducible deploy: a fresh environment cannot be built from this
repo, and the RLS policies that browser-side writes depend on cannot be reviewed.

Capturing it requires credentials for the hosted project, so it has to be run by someone who
has them:

```bash
npx supabase init          # if supabase/config.toml does not exist yet
npx supabase link --project-ref <your-project-ref>
npx supabase db pull       # writes the baseline into migrations/
git add supabase/ && git commit -m "chore: commit baseline database schema"
```

Run `npx supabase db pull` again afterwards and confirm it produces no diff. That is the check
that the repo and the live database actually agree.

## Reviewing RLS after the pull

Roughly 15 `insert`/`update`/`delete` calls run from the browser with the anon key, so their
RLS policies are the only thing standing between a user and someone else's data. Once the
baseline is committed, review the policies on these tables specifically:

- **`question_choices`** — holds `is_correct`, the exam answer key. It is written from
  `ExamSetupEditor.tsx` in the browser. An unauthenticated exam-taker must never be able to
  read this column. This is the highest-severity policy in the schema.
- **`assessment_questions`**, **`coursework_grades`**, **`group_coursework_categories`** —
  all written directly from client components.
- **`assessment_attempts`**, **`attempt_answers`** — reachable by unauthenticated students
  holding an attempt `access_token`.

## Applying migrations

```bash
npx supabase db push          # apply to the linked project
npx supabase migration new <name>   # author a new one
```

## Notes on the committed migration

`20260806000000_billing_and_retention.sql` **deletes duplicate rows** from
`attendance_records` before adding unique indexes over `(session_id, student_id)` and
`(session_id, device_id)`. Earliest row wins, matching the product rule that your first
check-in is the one that counts. Duplicates should be rare, but check the row count on a
staging copy before applying to production:

```sql
select session_id, student_id, count(*)
from attendance_records
group by session_id, student_id having count(*) > 1;
```
