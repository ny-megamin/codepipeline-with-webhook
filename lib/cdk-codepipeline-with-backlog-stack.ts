#!/usr/bin/env node
import cdk = require('@aws-cdk/core');
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as apigateway from '@aws-cdk/aws-apigateway';

//**************************************************** */
// buildspec.ymlの中から、functionNameに対してdeployされる想定
const stage = "dev"; // "stg","prd"
const functionName = stage + '-myFunction'
//**************************************************** */

// BacklogのGit情報
const repositoryName = 'test-project';
const branch = 'develop';
const user = 'user@example.jp'; 
const pass = 'xxxxxx'; 

export class CdkCodePipelineWithBacklogStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);

        const bucketName = 'source-bucket-' + this.account;
        const zipFileName = 'upload.zip';

        //**************************************************** */
        // プロジェクトの生成
        //**************************************************** */
        const project = new codebuild.PipelineProject(this, 'project', {
            projectName: 'myProject-' + stage,
            environment: {
                // 環境変数（関数名及び、ステージ）をbuildspec.ymlに送ってデプロイする
                environmentVariables: {
                    FUNCTION_NAME: {
                        type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                        value: functionName,
                    },
                    STAGE: {
                        type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                        value: stage,
                    }
                },
            }
        });
        // buildspc.ymlからLambdaをupdateするため、パーミッションを追加
        project.addToRolePolicy(new iam.PolicyStatement({
            resources: [`arn:aws:lambda:${this.region}:${this.account}:function:${functionName}`],
            actions: ['lambda:UpdateFunctionCode',
                      'lambda:UpdateFunctionConfiguration',] }
        ));

        // パイプラインの生成
        const sourceOutput = new codepipeline.Artifact();

        //**************************************************** */
        // ソースアクションの生成
        //**************************************************** */
        const sourceBucket = new s3.Bucket(this, 'sourceBucket', {
            bucketName: bucketName,
            versioned: true, // バージョニングが必須
        });
        const sourceAction = new codepipeline_actions.S3SourceAction({
            actionName: 'S3',
            bucket: sourceBucket,
            bucketKey: zipFileName,
            output: sourceOutput,
        });
        
        //**************************************************** */
        // ビルドアクションの生成
        //**************************************************** */
        const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'CodeBuild',
            project,
            input: sourceOutput,
            outputs: [new codepipeline.Artifact()]
        });

        //**************************************************** */
        // パイプラインの生成
        //**************************************************** */
        new codepipeline.Pipeline(this, 'pipeline', {
            pipelineName: 'myPipeline-' + stage,
            stages: [
                {
                    stageName: 'Source',
                    actions: [
                        sourceAction
                    ],
                },
                {
                    stageName: 'Build',
                    actions: [
                        buildAction
                    ],
                }
            ]
        })

        //**************************************************** */
        // Webhook用の Lambda
        //**************************************************** */
        const getFunction = new lambda.Function(this, "get-function",{
            functionName: this.stackName + "-getSourceFromBacklog",
            code: lambda.Code.fromAsset("lambda"),
            handler:"lambda_function.lambda_handler",
            runtime: lambda.Runtime.PYTHON_3_7,
            timeout: cdk.Duration.seconds(120),
            environment: {
                "BUCKET_NAME": bucketName,
                "ZIP_FILE_NAME": zipFileName,
                "REPOSITORY": repositoryName,
                "BLANCH": branch,
                "USER": user, 
                "PASS": pass, 
            }
        })
        getFunction.addToRolePolicy(new iam.PolicyStatement({
            resources: [`arn:aws:s3:::${bucketName}/${zipFileName}`],
            actions: ['s3:putObject'] }
        ));

        //**************************************************** */
        // Webhook用の API Gateway
        //**************************************************** */
        const api = new apigateway.RestApi(this, "api");
        const lambdaIntegration = new apigateway.LambdaIntegration(getFunction);
        api.root.addMethod("POST",lambdaIntegration);
        
    }
}
