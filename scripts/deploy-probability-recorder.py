"""Private minute probability observer. Existing IAM/trading settings unchanged."""
import hashlib,io,json,time,zipfile
from pathlib import Path
import boto3

ROOT=Path(__file__).resolve().parents[1]
NAME='sharpssignal-probability-timeline'
PREFIX='ops/movement_evidence/prediction-execution/live-pilot/v1/probability-timeline/v1/'
BUCKET='sharpsignal-ml-data'


def main():
    files={}
    for name in ('liveScores.cjs','liveProbability.cjs','liveStateModels.cjs','scoreTeamIdentity.cjs','liveTrackedPlays.cjs','probabilityTimeline.cjs'):
        files['lib/'+name]=(ROOT/'lib'/name).read_bytes()
    files['index.js']=(ROOT/'ops/probability-recorder/handler.cjs').read_bytes().replace(b'../../lib/',b'./lib/')
    deps=ROOT/'ops/probability-recorder/node_modules'
    if not (deps/'@aws-sdk/client-s3/package.json').is_file():raise ValueError('install_pinned_recorder_dependencies_first')
    for p in deps.rglob('*'):
        if p.is_file():files['node_modules/'+p.relative_to(deps).as_posix()]=p.read_bytes()
    lock=(ROOT/'ops/probability-recorder/package-lock.json').read_bytes()
    hashes={p:hashlib.sha256(v).hexdigest() for p,v in files.items() if not p.startswith('node_modules/')}
    hashes['dependency_lock']=hashlib.sha256(lock).hexdigest();release=hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest()
    files['release-manifest.json']=json.dumps({'release_id':release,'files':hashes,'orders_or_credentials':False}).encode()
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
        for p,raw in files.items():z.writestr(p,raw)
    aws=boto3.Session(region_name='us-east-2');lam=aws.client('lambda');s3=aws.client('s3');events=aws.client('events')
    trader=lam.get_function_configuration(FunctionName='sharpssignal-prediction-live-pilot')
    now=time.time();initial={'schema':'prediction_probability_index_v1','recording_started_at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'orders':{},'enabled':True,'health':'starting'}
    try:s3.put_object(Bucket=BUCKET,Key=PREFIX+'index.json',Body=json.dumps(initial).encode(),IfNoneMatch='*',ContentType='application/json',ServerSideEncryption='AES256')
    except Exception as exc:
        if getattr(exc,'response',{}).get('Error',{}).get('Code') not in ('PreconditionFailed','412'):raise
    raw=output.getvalue()
    try:before=lam.get_function_configuration(FunctionName=NAME)
    except lam.exceptions.ResourceNotFoundException:before=None
    if before:
        lam.update_function_code(FunctionName=NAME,RevisionId=before['RevisionId'],ZipFile=raw);lam.get_waiter('function_updated_v2').wait(FunctionName=NAME)
        lam.update_function_configuration(FunctionName=NAME,Environment={'Variables':{'RECORDER_RELEASE':release}})
        lam.get_waiter('function_updated_v2').wait(FunctionName=NAME)
    else:
        lam.create_function(FunctionName=NAME,Role=trader['Role'],Runtime='nodejs22.x',Handler='index.handler',Code={'ZipFile':raw},Timeout=90,MemorySize=256,
            Architectures=['x86_64'],Environment={'Variables':{'RECORDER_RELEASE':release}},LoggingConfig={'LogGroup':'/aws/lambda/sharpssignal-prediction-live-pilot'})
        lam.get_waiter('function_active_v2').wait(FunctionName=NAME)
    lam.put_function_concurrency(FunctionName=NAME,ReservedConcurrentExecutions=1)
    lam.put_function_event_invoke_config(FunctionName=NAME,MaximumRetryAttempts=0,MaximumEventAgeInSeconds=60)
    current=lam.get_function_configuration(FunctionName=NAME)
    rule=events.put_rule(Name=NAME+'-minute',ScheduleExpression='rate(1 minute)',State='ENABLED',Description='Private actual-bet probability samples; never places orders')
    try:lam.add_permission(FunctionName=NAME,StatementId='EventBridgeMinute',Action='lambda:InvokeFunction',Principal='events.amazonaws.com',SourceArn=rule['RuleArn'])
    except lam.exceptions.ResourceConflictException:pass
    result=events.put_targets(Rule=NAME+'-minute',Targets=[{'Id':'probability-timeline','Arn':current['FunctionArn'],'Input':'{}','RetryPolicy':{'MaximumRetryAttempts':0,'MaximumEventAgeInSeconds':60}}])
    assert result['FailedEntryCount']==0
    report={'function':NAME,'release':release,'schedule':'ENABLED','runtime':'nodejs22.x','pinned_sdk':'3.948.0','iam_unchanged':True,'trading_configuration_unchanged':lam.get_function_configuration(FunctionName='sharpssignal-prediction-live-pilot')['CodeSha256']==trader['CodeSha256'],'orders_created':0,'started_at':initial['recording_started_at']}
    (ROOT/'probability-recorder-deployment.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))


if __name__=='__main__':main()
