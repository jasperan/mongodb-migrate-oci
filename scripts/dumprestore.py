import subprocess
import sys
import os
import yaml

CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'config.yaml')
PASSWORD_ENV = 'MONGO_PASSWORD'

DUMP_CMD = [
    'mongodump',
    '--uri', 'mongodb://localhost:27017/mern_ecommerce?ssl=false&authSource=admin',
    # --username and --password will be appended
]

RESTORE_CMD = [
    'mongorestore',
    '--drop',
    '--uri', 'mongodb://localhost:27017/mern_ecommerce?loadBalanced=true&retryWrites=false&authMechanism=PLAIN&authSource=4external',
    '--nsInclude=merndemo',
    # --username and --password will be appended
    '--writeConcern', "{w:0}",
    '--tlsInsecure',
    './dump/merndemo'
]

def load_config():
    if not os.path.exists(CONFIG_FILE):
        print(f"Config file not found: {CONFIG_FILE}")
        sys.exit(1)
    with open(CONFIG_FILE, 'r') as f:
        try:
            data = yaml.safe_load(f)
            user = data.get('user')
            password = os.environ.get(PASSWORD_ENV)
            if not user:
                raise ValueError('user missing in config.yaml')
            if not password:
                raise ValueError(f'set {PASSWORD_ENV} in the environment')
            return user, password
        except Exception as e:
            print(f"Error loading config.yaml: {e}")
            sys.exit(1)

def run_cmd(cmd):
    try:
        print('Running:', ' '.join(cmd))
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Command failed: {e}")
        sys.exit(1)

def usage():
    print("""
Usage: python dumprestore.py [dump|restore]

  dump     - Run mongodump as the user in config.yaml
  restore  - Run mongorestore as the user in config.yaml

config.yaml should be in the same directory and hold only the user name:

user: sysdba

The password is read from the MONGO_PASSWORD environment variable.
""")
    sys.exit(1)

def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('dump', 'restore'):
        usage()
    user, password = load_config()
    if sys.argv[1] == 'dump':
        cmd = DUMP_CMD + ['-u', user, '-p', password]
        run_cmd(cmd)
    else:
        cmd = RESTORE_CMD.copy()
        cmd.insert(5, '--username')
        cmd.insert(6, user)
        cmd.insert(7, '--password')
        cmd.insert(8, password)
        run_cmd(cmd)

if __name__ == '__main__':
    main() 