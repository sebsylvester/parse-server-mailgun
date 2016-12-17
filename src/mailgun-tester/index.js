const
    // NOTE: you need to create mailgun.json yourself in the module's root directory
    /* Example
    {
        "apiKey": "...",
        "fromAddress": "...",
        "domain": "...",
        "recipient": "...",
        "username": "...",
        "appName": "..."
    }
    */
    mailgunConfig = require('../../mailgun.json'),
    API_KEY = mailgunConfig.apiKey,
    FROM = mailgunConfig.fromAddress,
    DOMAIN = mailgunConfig.domain,
    RECIPIENT = mailgunConfig.recipient,
    USERNAME = mailgunConfig.username,
    APP_NAME = mailgunConfig.appName;

const MailgunAdapter = require('../MailgunAdapter');
const path = require('path');
const Parse = {
    User: class User {
        get(key) {
            if(key === 'username') return USERNAME;
            else if(key === 'email') return RECIPIENT;
        }
    }
};

const config = {
    apiKey: API_KEY,
    fromAddress: FROM,
    domain: DOMAIN,
    templates: {
        passwordResetEmail: {
            subject: 'Reset your password',
            pathPlainText: path.resolve(__dirname, '../../test/email-templates/password_reset_email.txt'),
            pathHtml: path.resolve(__dirname, '../../test/email-templates/password_reset_email.html'),
            callback: (user) => {}
        },
        verificationEmail: {
            subject: 'Confirm your account',
            pathPlainText: path.resolve(__dirname, '../../test/email-templates/verification_email.txt'),
            pathHtml: path.resolve(__dirname, '../../test/email-templates/verification_email.html'),
            callback: (user) => {}
        },
        customAlert: {
            subject: 'Important notice',
            pathPlainText: path.resolve(__dirname, '../../test/email-templates/custom_email.txt'),
            pathHtml: path.resolve(__dirname, '../../test/email-templates/custom_email.html'),
            variables: {
                username: USERNAME,
                appName: APP_NAME
            }
        }
    }
};

const adapter = new MailgunAdapter(config);
const user = new Parse.User();

adapter._sendMail({
    templateName: 'customAlert',
    subject: 'Test message',
    recipient: RECIPIENT,
    variables: { appName: APP_NAME, username: USERNAME },
    direct: true
});