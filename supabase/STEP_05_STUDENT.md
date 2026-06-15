# Step 5 — Student dashboard, feed posts & feedback

## Campus feed (`/student`)

- Posts live in **`student_feed_posts`** (caption, optional image, event title/date/venue).
- **SSC** and **student officers** use **Create post** anytime (no approval required for the feed).
- Optional link to an event request → enables **Download Word** on Events.

## Student feedback

- Students open a post on **`/student`** → **Leave feedback** (1–5 stars + preset comment).
- Stored in **`event_feedback`** linked to **`feed_post_id`** (anonymous — no student user id saved).
- **SSC** and **student officers** see responses under **Analytics → Student feedback**.

## Staff calendar vs student feed

| Who | Action | Where it shows |
|-----|--------|----------------|
| EO | Post to calendar | Staff schedule calendars |
| SSC / officer | Create post | `/student` feed |

Event **requests** still use the approval workflow separately.

## Migrations (run in order)

1. `20260528500000_submitter_publish_rls.sql`
2. `20260528600000_student_posted_events_public.sql`
3. `20260528700000_calendar_vs_student_post.sql`
4. `20260528800000_student_post_content.sql`
5. `20260528900000_student_feed_posts.sql`
6. `20260529000000_student_feed_public_read.sql`
7. `20260529100000_feedback_feed_posts.sql`

## Test feedback

1. SSC/officer: **Create post** → open `/student` → open post → **Leave feedback** → submit.
2. SSC/officer: **Analytics** → scroll to **Student feedback** → see rating and comment.
