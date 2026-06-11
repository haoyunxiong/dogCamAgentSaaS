"""Migrate data from SQLite into the configured MySQL database."""
import sqlite3
import pymysql
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
PYTHON_DIR = ROOT_DIR / 'python'
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from mysql_config import load_mysql_config

DEFAULT_SQLITE_PATH = r'E:\XianyuAgentData\app_config.db'


def resolve_sqlite_path():
    if len(sys.argv) > 1 and sys.argv[1]:
        return sys.argv[1]
    return DEFAULT_SQLITE_PATH

def migrate():
    sqlite_path = resolve_sqlite_path()
    src = sqlite3.connect(sqlite_path)
    src.row_factory = sqlite3.Row
    dst = pymysql.connect(**load_mysql_config())
    cur = dst.cursor()
    
    tables = [
        ('config', '`key`', ['key', 'value', 'updated_at'],
         "INSERT INTO config (`key`, `value`, updated_at) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_at=VALUES(updated_at)"),
        ('prompts', 'name', ['name', 'content', 'updated_at'],
         "INSERT INTO prompts (name, content, updated_at) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE content=VALUES(content), updated_at=VALUES(updated_at)"),
        ('knowledge', 'id', ['id', 'item_id', 'scope_type', 'model_code', 'question', 'answer', 'tags', 'source_type', 'status', 'confidence_threshold', 'embedding', 'updated_at'],
         None),
        ('takeover_tasks', 'id', None, None),
        ('schedule_units', 'id', None, None),
        ('rental_orders', 'id', None, None),
        ('schedule_blocks', 'id', None, None),
        ('shipping_records', 'id', None, None),
        ('learning_candidates', 'id', None, None),
        ('feishu_pending_replies', 'id', None, None),
        ('market_snapshots', 'id', None, None),
        ('market_listings', 'id', None, None),
        ('expense_records', 'id', None, None),
    ]
    
    total = 0
    for table_info in tables:
        table = table_info[0]
        try:
            rows = src.execute(f"SELECT * FROM {table}").fetchall()
        except Exception as e:
            print(f"  ⚠️  {table}: {e}")
            continue
        
        if not rows:
            print(f"  ⏭  {table}: 0 rows")
            continue
        
        # Get column names from SQLite
        cols = [desc[0] for desc in src.execute(f"SELECT * FROM {table} LIMIT 1").description]
        
        # Build INSERT SQL
        # Use backticks for reserved words
        col_list = ', '.join(f'`{c}`' for c in cols)
        placeholders = ', '.join(['%s'] * len(cols))
        sql = f"INSERT INTO `{table}` ({col_list}) VALUES ({placeholders})"
        
        count = 0
        for row in rows:
            values = [row[c] for c in cols]
            # Convert bytes to None for non-blob fields, keep for embedding
            try:
                cur.execute(sql, values)
                count += 1
            except pymysql.err.IntegrityError:
                pass  # skip duplicates
            except Exception as e:
                print(f"    Error in {table}: {e}")
                continue
        
        dst.commit()
        total += count
        print(f"  ✅ {table}: {count}/{len(rows)} rows migrated")
    
    cur.close()
    dst.close()
    src.close()
    print(f"\n✅ Total: {total} rows migrated to MySQL")

if __name__ == '__main__':
    migrate()
