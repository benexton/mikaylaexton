-- =============================================================================
-- The Big Chill: one-time play codes, transcribed from docs/Big-Chill-pw.pdf.
-- Run once (after bigchill_schema.sql has created bigchill_passwords) in the
-- Supabase SQL editor on the Big Chill project (dwvsniafixisrfrszjjr).
-- Idempotent - re-running this after some codes are already redeemed will
-- not reset or duplicate anything, it only inserts codes that aren't there.
-- =============================================================================

insert into public.bigchill_passwords (code) values
  ('hpzXAVQY'), ('9m6AU5RW'), ('NC3Xg6fj'), ('pr9raCNr'), ('HnKEPXhz'),
  ('zq2eHnAA'), ('rLQzWNTY'), ('bTtKy7kE'), ('kYj7JwKQ'), ('wv7Esewy'),
  ('gDchcjN6'), ('GpVhKugz'), ('WXj5jyY9'), ('PS2uNnkm'), ('5YKDUAnu'),
  ('DzXBCfEM'), ('8xP9J8ZB'), ('5mBvycAV'), ('HS8J9W5R'), ('5Q3HNfUr'),
  ('7u46yJdg'), ('evmEQqtC'), ('nNvTfrpU'), ('aNXvHZxg'), ('vL9XLaL7'),
  ('BkpZTHsV'), ('T98E33J6'), ('DaDacXJc'),
  ('3FnWcj9k'), ('evKCPFAJ'), ('TB9SuLFR'), ('q9LysGPq'), ('pTtT25aY'),
  ('dTJrYbgf'), ('j78GUFMk'), ('Hn3gkf8s'), ('jfRANREg'), ('ttrWdMy2'),
  ('jT8z8yhw'), ('23kZdXGh'), ('NjJ8AMdM'), ('6PLXPW3P'), ('XgT9K7wK'),
  ('nj5PKbrP'), ('Lp79YWSX'), ('yvNEUTW8'), ('GjsATtU5'), ('dd22ceLW'),
  ('VMEy4u7a'), ('Umt2btZk'), ('NWEadJVE'), ('tua3dJdy'), ('wzTjKGe5'),
  ('vDe6ux5T'), ('2R7raUuL'), ('gagzUtDX'),
  ('v8KUbsDZ'), ('DjbXtG2B'), ('654CNm74'), ('gNykRaBz'), ('G6fLvPRr'),
  ('Au6t4HAF'), ('MQVM37sg'), ('G8PX9AHY'), ('JJJLqcBm'), ('nNhLcKLB'),
  ('7fjppWLJ'), ('FJj5xyt3'), ('7KRALAwA'), ('Sgf6Dq5j'), ('CHmhTqLu'),
  ('cML2FGDs'), ('XbJcLP6S'), ('sL7yL7Yj'), ('eZ6f3F2y'), ('pyqQ5KVS'),
  ('LgUf3QvV'), ('kDAx5XRZ'), ('3fTZTvUm'), ('bmXjSyxE'), ('5NppSdtB'),
  ('xSFUXvcV'), ('ZFV9V4Hx'), ('4a4nvznG'),
  ('JF4fMRsW'), ('nzF4WavY'), ('xBbjjXd2'), ('D8gGxzgQ'), ('GCecNmYT'),
  ('RMWMngKu'), ('vGzukuYf'), ('JJKN32uU'), ('6eJtT6vU'), ('PccUdkxZ'),
  ('Urtu4wwN'), ('7ZYAj6mD'), ('7Nrhq5k9'), ('wrkhKMQQ'), ('Jpzus5sb'),
  ('T7vU2g4L')
on conflict (code) do nothing;
