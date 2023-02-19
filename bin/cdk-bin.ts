#!/usr/bin/env node
import cdk = require('@aws-cdk/core');
import { CdkCodePipelineWithBacklogStack } from '../lib/cdk-codepipeline-with-backlog-stack';

const app = new cdk.App();
new CdkCodePipelineWithBacklogStack(app, 'CdkCodePipelineWithBacklogStack');
