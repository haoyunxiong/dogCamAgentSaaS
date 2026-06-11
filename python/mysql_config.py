import json
import os
from pathlib import Path


DEFAULT_MYSQL_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': '',
    'database': 'xianyu_agent',
    'charset': 'utf8mb4',
}


def _candidate_config_paths():
    paths = []
    env_path = os.environ.get('XIANYU_MYSQL_CONFIG')
    if env_path:
        paths.append(Path(env_path))
    cwd = Path.cwd()
    here = Path(__file__).resolve()
    paths.extend([
        cwd / 'mysql-connection.json',
        cwd.parent / 'mysql-connection.json',
        here.parent.parent / 'mysql-connection.json',
        here.parent.parent.parent / 'mysql-connection.json',
    ])
    seen = set()
    result = []
    for item in paths:
        text = str(item)
        if text not in seen:
            seen.add(text)
            result.append(item)
    return result


def _load_file_config():
    for path in _candidate_config_paths():
        if path.exists():
            with path.open('r', encoding='utf-8') as fh:
                return json.load(fh)
    return {}


def _load_env_config():
    env = os.environ
    config = {}
    if env.get('XIANYU_MYSQL_HOST'):
        config['host'] = env['XIANYU_MYSQL_HOST']
    if env.get('XIANYU_MYSQL_PORT'):
        config['port'] = int(env['XIANYU_MYSQL_PORT'])
    if env.get('XIANYU_MYSQL_USER'):
        config['user'] = env['XIANYU_MYSQL_USER']
    if 'XIANYU_MYSQL_PASSWORD' in env:
        config['password'] = env['XIANYU_MYSQL_PASSWORD']
    if env.get('XIANYU_MYSQL_DATABASE'):
        config['database'] = env['XIANYU_MYSQL_DATABASE']
    if env.get('XIANYU_MYSQL_CHARSET'):
        config['charset'] = env['XIANYU_MYSQL_CHARSET']
    return config


def load_mysql_config(**overrides):
    config = {
        **DEFAULT_MYSQL_CONFIG,
        **_load_file_config(),
        **_load_env_config(),
        **overrides,
    }
    config['port'] = int(config.get('port') or DEFAULT_MYSQL_CONFIG['port'])
    config.pop('socketPath', None)
    config.pop('unix_socket', None)
    config.pop('timezone', None)
    config.pop('connectionLimit', None)
    config.pop('waitForConnections', None)
    return config
