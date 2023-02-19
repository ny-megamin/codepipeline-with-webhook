import json
import urllib.parse
import os
import tempfile
import shutil
import boto3
from dulwich import porcelain

BUCKET_NAME = os.environ['BUCKET_NAME']
ZIP_FILE_NAME = os.environ['ZIP_FILE_NAME']
USER = os.environ['USER']
PASS = os.environ['PASS']
REPOSITORY = os.environ['REPOSITORY']
BLANCH = os.environ['BLANCH']

def lambda_handler(event, context):
    
    payloadStr = urllib.parse.unquote(event["body"][8:]) # event["body"]  payload="xxxxxx"
    
    payload = json.loads(payloadStr) 
    repository = payload["repository"]["name"]
    url = payload["repository"]["url"]
    branch = payload["ref"][11:] # refs/heads/master"

    print(f"repository:{repository} branch:{branch} uri:{url}")

    if repository == REPOSITORY and branch == BLANCH:
        # gitパスの生成
        site = urllib.parse.urlparse(url)
        userStr = urllib.parse.quote(USER)
        passStr = urllib.parse.quote(PASS)
        uri = site.scheme +"://" + userStr + ":" + passStr +"@" + site.netloc + site.path + ".git"
        
        # 作業ディレクトリの生成
        tmpDir  = tempfile.mkdtemp()
        
        # clone/zip/upload
        try:
            porcelain.clone(uri, tmpDir)
            print("git clone success")
            
            zipFileName = tmpDir+ '/' + os.path.splitext(ZIP_FILE_NAME)[0]
            shutil.make_archive(zipFileName, 'zip', tmpDir )
            print("zip success")
            
            s3 = boto3.client('s3')
            s3.upload_file(zipFileName + '.zip', BUCKET_NAME, ZIP_FILE_NAME)
            print("s3 upload success")
        except Exception as e:
            print("ERROR" +  e)
        
        # 後始末
        shutil.rmtree(tmpDir)
