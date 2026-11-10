-- The course demo account uses the same password checks as every account.
INSERT INTO users (id, email, name, password_hash, is_demo)
VALUES ('00000000-0000-4000-8000-000000000001', 'demo@demo.com', 'SetFlow Demo', 'scrypt:f6f379b90b3b1db7e5d504e00e83d371:a4fc5160315b985139ace0ff3c58c56a2657650d53d9d1f82d2bb577e7cfde5e8c80c47ac283febae7835621772db51399a180fc60262057f417abc1c7312af5', true)
ON CONFLICT (email) DO NOTHING;
