'use strict';
const fs = require('fs');
const Generator = require('yeoman-generator');

const buildPolicy = (serviceName, stage, region, aws_account_id) => {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'cloudformation:List*',
          'cloudformation:Get*',
          'cloudformation:ValidateTemplate'
        ],
        Resource: ['*']
      },
      {
        Effect: 'Allow',
        Action: [
          "cloudformation:CreateStack",
          "cloudformation:CreateUploadBucket",
          "cloudformation:DeleteStack",
          "cloudformation:Describe*",
          "cloudformation:UpdateStack"
        ],
        Resource: [
          `arn:aws:cloudformation:${region}:${aws_account_id}:stack/${serviceName}-${stage}/*`
        ]
      },
      {
        Effect: 'Allow',
        Action: ['lambda:Get*', 'lambda:List*', 'lambda:CreateFunction'],
        Resource: ['*']
      },
      {
        Effect: 'Allow',
        Action: [
          "s3:GetBucketLocation",
          "s3:CreateBucket",
          "s3:DeleteBucket",
          "s3:ListBucket",
          "s3:ListBucketVersions",
          "s3:PutAccelerateConfiguration",
          "s3:GetEncryptionConfiguration",
          "s3:PutEncryptionConfiguration"
        ],
        Resource: [`arn:aws:s3:::${serviceName}*serverlessdeploy*`]
      },
      {
        Effect: 'Allow',
        Action: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ],
        Resource: [`arn:aws:s3:::${serviceName}*serverlessdeploy*`]
      },
      {
        Effect: 'Allow',
        Action: [
          'lambda:AddPermission',
          'lambda:CreateAlias',
          'lambda:DeleteFunction',
          'lambda:InvokeFunction',
          'lambda:PublishVersion',
          'lambda:RemovePermission',
          'lambda:Update*'
        ],
        Resource: [
          `arn:aws:lambda:${region}:${aws_account_id}:function:${serviceName}-${stage}-*`
        ]
      },
      {
        Effect: 'Allow',
        Action: [
          'apigateway:GET',
          'apigateway:POST',
          'apigateway:PUT',
          'apigateway:DELETE',
          "apigateway:PATCH"
        ],
        Resource: [
          'arn:aws:apigateway:*::/restapis*',
          'arn:aws:apigateway:*::/apikeys*',
          'arn:aws:apigateway:*::/usageplans*'
        ]
      },
      {
        Effect: 'Allow',
        Action: ['iam:PassRole'],
        Resource: [
          `arn:aws:iam::*:role/${serviceName}-${stage}-${region}-lambdaRole`
        ]
      },

      {
        Effect: 'Allow',
        Action: [
          'iam:GetRole',
          'iam:GetRolePolicy',
          'iam:GetPolicy',
          'iam:CreateRole',
          'iam:PutRolePolicy',
          'iam:DeleteRolePolicy',
          'iam:DetachRolePolicy',
          'iam:AttachRolePolicy',
          'iam:DeleteRole'
        ],
        Resource: [
          `arn:aws:iam::*:role/${serviceName}-${stage}-${region}-lambdaRole`
        ]
      },
      {
        Effect: 'Allow',
        Action: ['cloudwatch:GetMetricStatistics'],
        Resource: ['*']
      },
      {
        Action: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:DeleteLogGroup'
        ],
        Resource: [`arn:aws:logs:${region}:${aws_account_id}:*`],
        Effect: 'Allow'
      },
      {
        Action: ['logs:PutLogEvents'],
        Resource: [`arn:aws:logs:${region}:${aws_account_id}:*`],
        Effect: 'Allow'
      },
      {
        Effect: 'Allow',
        Action: [
          'logs:DescribeLogStreams',
          'logs:DescribeLogGroups',
          'logs:FilterLogEvents'
        ],
        Resource: ['*']
      },
      {
        Effect: 'Allow',
        Action: ['events:Put*', 'events:Remove*', 'events:Delete*'],
        Resource: [`arn:aws:events:*:*:rule/${serviceName}-${stage}-${region}`]
      },
      {
        Effect: 'Allow',
        Action: ['events:DescribeRule'],
        Resource: [`arn:aws:events:${region}:*:rule/${serviceName}-${stage}-*`]
      }
    ]
  };
};

const escapeValFilename = function(val) {
  return val === '*' ? '_star_' : val;
};

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);

    this.option('project', {
      description: 'The name of the Serverless project',
      type: String
    });
    this.option('stage', {
      description: 'The name of a single stage to target',
      type: String,
      default: '*'
    });
    this.option('region', {
      description: 'The name of a single region to target',
      type: String,
      default: '*'
    });
    this.option('kms_key', {
      description: 'The name of a single KMS key to grant encrypt/decrypt access to',
      type: String,
      default: ''
    });
    this.option('aws_account_id', {
      description: 'The AWS Account ID this role has access to',
      type: String,
      default: '*'
    });
  }

  prompting() {
    return this.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Your Serverless service name',
        default: this.appname // Default to current folder name
      },
      {
        type: 'input',
        name: 'stage',
        message: 'You can specify a specific stage, if you like:',
        default: '*'
      },
      {
        type: 'input',
        name: 'region',
        message: 'You can specify a specific region, if you like:',
        default: '*'
      },
      {
        type: 'input',
        name: 'kms_key',
        message: 'You can specify a single KMS key to grant encrypt/decrypt access to',
        default: ''
      },
      {
        type: 'input',
        name: 'aws_account_id',
        message: 'You can specify which aws account id to restrict access to',
        default: '*'
      },
      {
        type: 'confirm',
        name: 'dynamodb',
        message: 'Does your service rely on DynamoDB?'
      },
      {
        type: 'confirm',
        name: 'kinesis',
        message: 'Does your service rely on kinesis?'
      },
      {
        type: 'confirm',
        name: 'apigateway',
        message: 'Does your service rely on API Gateway?'
      },
      {
        type: 'confirm',
        name: 'sqs',
        message: 'Does your service rely on SQS?'
      },
      {
        type: 'confirm',
        name: 's3',
        message: 'Is your service going to be using S3 buckets?'
      },
      {
        type: 'confirm',
        name: 'run_vpc',
        message: 'Will your function run inside a VPC?'
      }
    ]).then(answers => {
      this.slsSettings = answers;
      this.log('app name', answers.name);
      this.log('app stage', answers.stage);
      this.log('app region', answers.region);
      this.log('KMS key', answers.kms_key);
      this.log('AWS Account Id', answers.aws_account_id);
    });
  }

  writing() {
    const done = this.async();

    const project = this.slsSettings.name;
    const stage = this.slsSettings.stage;
    const region = this.slsSettings.region;
    const aws_account_id = this.slsSettings.aws_account_id;
    const kms_key = this.slsSettings.kms_key;

    const policy = buildPolicy(project, stage, region, aws_account_id);

    if (this.slsSettings.dynamodb) {
      policy.Statement.push({
        Effect: 'Allow',
        Action: ['dynamodb:*'],
        Resource: ['arn:aws:dynamodb:*:*:table/*']
      });
    }

    if (this.slsSettings.kms_key) {
      policy.Statement.push({
        Effect: 'Allow',
        Action: [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:DescribeKey",
          "kms:ReEncrypt*"
        ],
        Resource: [
            `arn:aws:kms:${region}:${aws_account_id}:key/${kms_key}`
        ]
      });
      policy.Statement.push({
        Effect: 'Allow',
        Action: [
           'kms:ListKeys',
           'kms:ListAliases'
        ],
        Resource: ['*']
      });
    }

    if (this.slsSettings.kinesis) {
      policy.Statement.push({
        Effect: 'Allow',
        Action: ['kinesis:*'],
        Resource: [`arn:aws:kinesis:*:*:stream/${serviceName}-${stage}-${region}`]
      });
    }

    if (this.slsSettings.sqs) {
      policy.Statement.push({
        Effect: 'Allow',
        Action: ['sqs:*'],
        Resource: [`arn:aws:sqs:*:*:${serviceName}-${stage}-${region}`]
      });
    }

    if (this.slsSettings.run_vpc) {
      policy.Statement.push({
        Effect: 'Allow',
        Action: [
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:GetPolicy",
          "iam:GetPolicyVersion"
        ],
        Resource: [`arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole`]
      });
    }

    if (this.slsSettings.apigateway) {
      policy.Statement.push({
        Effect: 'Allow',
        Action: [
          'apigateway:GET',
          'apigateway:POST',
          'apigateway:PUT',
          'apigateway:DELETE'
        ],
        Resource: ['arn:aws:apigateway:*::/restapis*']
      });
    }

    if (this.slsSettings.s3) {
      policy.Statement.push({
        Effect: 'Allow',
        Action: ['s3:CreateBucket'],
        Resource: [`arn:aws:s3:::*`]
      });
    }

    const policyString = JSON.stringify(policy, null, 2);
    const fileName = `${project}-${escapeValFilename(stage)}-${escapeValFilename(region)}-policy.json`;

    this.log(`Writing to ${fileName}`);
    fs.writeFile(fileName, policyString, done);
  }
};
