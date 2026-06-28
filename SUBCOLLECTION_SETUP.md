# Subcollection Feature — Supabase Setup

Run this SQL in your Supabase SQL Editor to add the subcollections column:

```sql
ALTER TABLE collections ADD COLUMN IF NOT EXISTS subcollections JSONB DEFAULT '[]'::jsonb;
```

That's it! The subcollections data will be stored as a JSON array inside the collections table.
