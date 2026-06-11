# python/mysql_helper.py
"""
Shared MySQL connection helper for Python modules.
Uses the same mysql-connection.json / environment overrides as Node.js.
"""
import pymysql
from mysql_config import load_mysql_config

MYSQL_CONFIG = load_mysql_config(cursorclass=pymysql.cursors.DictCursor)


def get_connection(**overrides):
    """Get a new pymysql connection (caller must close it)."""
    config = load_mysql_config(cursorclass=pymysql.cursors.DictCursor, **overrides)
    return pymysql.connect(**config)


class MysqlCursorWrapper:
    """
    Wraps a pymysql cursor to provide a sqlite3-like interface.
    Allows code like: row = c.execute("SELECT ...", (params,)).fetchone()
    """
    def __init__(self, cursor):
        self._cursor = cursor
    
    def execute(self, sql, params=None):
        self._cursor.execute(sql, params)
        return self  # allow chaining .fetchone()
    
    def executemany(self, sql, params_list):
        self._cursor.executemany(sql, params_list)
        return self
    
    def fetchone(self):
        return self._cursor.fetchone()
    
    def fetchall(self):
        return self._cursor.fetchall()
    
    @property
    def lastrowid(self):
        return self._cursor.lastrowid
    
    @property
    def rowcount(self):
        return self._cursor.rowcount


class MysqlConnectionWrapper:
    """
    Wraps a pymysql connection to provide a sqlite3-like interface.
    Supports: conn.execute(sql, params).fetchone(), conn.commit(), conn.close()
    Works with `with` statement (context manager).
    """
    def __init__(self, conn):
        self._conn = conn
        self._cursor = MysqlCursorWrapper(conn.cursor())
    
    def execute(self, sql, params=None):
        return self._cursor.execute(sql, params)
    
    def executemany(self, sql, params_list):
        return self._cursor.executemany(sql, params_list)
    
    def cursor(self):
        return self._cursor
    
    def commit(self):
        self._conn.commit()
    
    def close(self):
        self._conn.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self._conn.commit()
        self._conn.close()
        return False


def get_sqlite_like_connection(**overrides):
    """Get a MySQL connection wrapped to behave like sqlite3 connection."""
    conn = get_connection(**overrides)
    return MysqlConnectionWrapper(conn)
