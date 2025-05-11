# IAM User Setup for S3 Access

This guide explains how to set up an IAM user with restricted access to just the "zivepublic" S3 bucket.

## Create an IAM Policy

1. **Sign in to the AWS Management Console**:
   - Open the IAM console at [https://console.aws.amazon.com/iam/](https://console.aws.amazon.com/iam/)

2. **Create a new policy**:
   - In the navigation pane, click **Policies**, then **Create policy**
   - Click the **JSON** tab
   - Copy and paste the policy from the `zive-s3-policy.json` file:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::zivepublic",
        "arn:aws:s3:::zivepublic/dams/*"
      ]
    }
  ]
}
```

   - Click **Next: Tags** (add tags if desired)
   - Click **Next: Review**
   - Name the policy `ZivePublicS3Access` and add a description
   - Click **Create policy**

## Option 1: Create a New IAM User

1. **Create a new IAM user**:
   - In the navigation pane, click **Users**, then **Add users**
   - Enter a user name (e.g., `media-management-app`)
   - Select **Access key - Programmatic access**
   - Click **Next: Permissions**

2. **Attach the policy**:
   - Click **Attach existing policies directly**
   - Search for `ZivePublicS3Access` and select it
   - Click **Next: Tags** (add tags if desired)
   - Click **Next: Review**
   - Click **Create user**

3. **Save the credentials**:
   - **IMPORTANT**: Download the CSV file or copy the **Access key ID** and **Secret access key**
   - These credentials will only be shown once!
   - Update your `.env` file with these credentials

## Option 2: Attach Policy to an Existing User

1. **Find the existing user**:
   - In the navigation pane, click **Users**
   - Click on the name of the user you want to modify

2. **Attach the policy**:
   - On the **Permissions** tab, click **Add permissions**
   - Click **Attach existing policies directly**
   - Search for `ZivePublicS3Access` and select it
   - Click **Next: Review**
   - Click **Add permissions**

## Verify S3 Access

1. **Update your `.env` file**:
   - Make sure the AWS credentials are set correctly
   - Set `S3_BUCKET=zivepublic`
   - Set `USE_S3_STORAGE=true`

2. **Test the application**:
   - Start your server: `cd server && npm run dev`
   - Try uploading a file through the application
   - Verify the file appears in the `dams` folder of your `zivepublic` bucket

## Security Notes

This policy is designed to:
- Only allow access to the `zivepublic` bucket
- Only permit operations within the `dams/` folder
- Allow only the specific operations needed:
  - `PutObject`: Upload files
  - `GetObject`: Download files
  - `DeleteObject`: Delete files
  - `ListBucket`: List files in the bucket

The user will not be able to:
- Access any other S3 buckets
- Create or delete buckets
- Modify bucket policies or ACLs
- Access files outside the `dams/` folder