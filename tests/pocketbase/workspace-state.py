"""Local-only PocketBase migration/rules smoke test. Start isolated PB on :8097 first."""
import json, urllib.request, urllib.error, uuid
BASE = 'http://127.0.0.1:8097'
def request(path, method='GET', data=None, token=None, expected=200):
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = token
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode() if data is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response: status, body = response.status, json.load(response)
    except urllib.error.HTTPError as error: status, body = error.code, json.load(error)
    assert status == expected, f'{method} {path}: expected {expected}, got {status}'
    return body
admin = request('/api/collections/_superusers/auth-with-password', 'POST', {'identity': 'sync-admin@example.test', 'password': 'local-sync-test-password'})['token']
users=[]
for index in range(2):
    email=f'sync-{uuid.uuid4().hex}@example.test'
    row=request('/api/collections/users/records', 'POST', {'email': email, 'password':'local-user-test-password', 'passwordConfirm':'local-user-test-password'}, admin)
    token=request('/api/collections/users/auth-with-password', 'POST', {'identity':email,'password':'local-user-test-password'})['token']
    users.append((row['id'],token))
a,at=users[0];b,bt=users[1]
path='/api/collections/atlas_workspace_state/records'
row=request(path,'POST',{'user':a,'key':'lesson:dark-adaptation','value':True,'client_updated_at':'2026-11-06T20:00:00.000Z'},at)
request(path+'/'+row['id'],token=bt,expected=404)
assert request(path,token=bt)['items']==[]
request(path,'POST',{'user':a,'key':'preference:equipment','value':'telescope','client_updated_at':'2026-11-06T20:00:00.000Z'},bt,expected=400)
request(path+'/'+row['id'],'PATCH',{'user':b},at,expected=404)
request(path,'POST',{'user':a,'key':'lesson:dark-adaptation','value':True,'client_updated_at':'2026-11-06T20:00:00.000Z'},at,expected=400)
assert request(path+'/'+row['id'],token=at)['value'] is True
request(path,expected=200) # unauthenticated list must be empty under list-rule filtering
assert request(path)['items']==[]
print('PASS: migration, owner read/write rules, cross-account isolation, unique user/key index, and JSON values')
