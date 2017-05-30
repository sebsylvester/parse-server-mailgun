# parse-server-mailgun 

[![npm version](https://badge.fury.io/js/parse-server-mailgun.svg)](https://badge.fury.io/js/parse-server-mailgun)
[![Build Status](https://travis-ci.org/sebsylvester/parse-server-mailgun.svg?branch=master)](https://travis-ci.org/sebsylvester/parse-server-mailgun) 
[![codecov](https://codecov.io/gh/sebsylvester/parse-server-mailgun/branch/master/graph/badge.svg)](https://codecov.io/gh/sebsylvester/parse-server-mailgun)

Allows your Parse Server app to send template-based emails through Mailgun. Just add your template files (plain text and html) to the email adapter's configuration.

## Installation

`npm install --save parse-server-mailgun`

## Configure test utility
To quickly test the adapter with your own Mailgun api key and domain, create a configuration file ```mailgun.json``` in the module's root directory:
```
Example:
{
   "apiKey": "your mailgun api key",
   "fromAddress": "Team <noreply@yourdomain.com>",
   "domain": "yourdomain.com",
   "recipient": "your@email.com",
   "username": "you",
   "appName": "YourApp"
}
```
Then, inside the module's root directory, run ```node ./src/mailgun-tester```

## Adapter configuration
As is the case with the default Mailgun adapter that comes with the Parse Server, you need to set a **fromAddres**, and the **domain** and **apiKey** provided by Mailgun.
In addition, you also need to configure the **templates** you want to use.
You must provide at least a plain-text version for each template. The html versions are optional.

```js
const resolve = require('path').resolve;
// Note that the paths to the templates are absolute.
var server = ParseServer({
  ...otherOptions,
  // Enable email verification
  verifyUserEmails: true,
  emailAdapter: {
    module: 'parse-server-mailgun',
    options: {
      // The address that your emails come from
      fromAddress: 'YourApp <noreply@yourapp.com>',
      // Your domain from mailgun.com
      domain: 'example.com',
      // Your API key from mailgun.com
      apiKey: 'key-mykey',
      // The template section
      templates: {
        passwordResetEmail: {
          subject: 'Reset your password',
          pathPlainText: resolve(__dirname, 'path/to/templates/password_reset_email.txt'),
          pathHtml: resolve(__dirname, 'path/to/templates/password_reset_email.html'),
          callback: (user) => { return { firstName: user.get('firstName') }}
          // Now you can use {{firstName}} in your templates
        },
        verificationEmail: {
          subject: 'Confirm your account',
          pathPlainText: resolve(__dirname, 'path/to/templates/verification_email.txt'),
          pathHtml: resolve(__dirname, 'path/to/templates/verification_email.html'),
          callback: (user) => { return { firstName: user.get('firstName') }}
          // Now you can use {{firstName}} in your templates
        },
        customEmailAlert: {
          subject: 'Urgent notification!',
          pathPlainText: resolve(__dirname, 'path/to/templates/custom_alert.txt'),
          pathHtml: resolve(__dirname, 'path/to/templates/custom_alert.html'),
        }
      }
    }
  }
});
```

### Templates
The Parse Server only uses the MailgunAdapter for two use cases: password reset and email address verification.
With a few lines of code, it's also possible to use the MailgunAdapter directly, so that you can send any other template-based email, 
provided it has been configured as shown in the example configuration above.

```js
// Get access to Parse Server's cache
const { AppCache } = require('parse-server/lib/cache');
// Get a reference to the MailgunAdapter
// NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
const MailgunAdapter = AppCache.get('yourAppId').userController.adapter;

// Invoke the send method with an options object
MailgunAdapter.send({
  templateName: 'customEmailAlert',
  // Optional override of your configuration's subject
  subject: 'Important: action required',
  // Optional override of the adapter's fromAddress
  fromAddress: 'Alerts <noreply@yourapp.com>',
  recipient: 'user@email.com',
  variables: { alert: 'New posts' } // {{alert}} will be compiled to 'New posts'
  // Additional message fields can be included with the "extra" option
  // See https://nodemailer.com/extras/mailcomposer/#e-mail-message-fields for an overview of what can be included
  extra: {
    attachments: [/* include attachment objects */]
    replyTo: 'reply-to-address'
  }
});
```

Version 2.4.0 switched from templating with lodash.template to using the excellent [Mustache](https://github.com/janl/mustache.js) library. This allows for a lot more flexibility in your template code. For example, you can now pass an array as one of the template variables:
```js
MailgunAdapter.send({
  //...
  variables: { 
    stooges: [
      { name: "Moe" }, 
      { name: "Larry" }, 
      { name: "Curly" }
    ]
  }
});
```

So that your templates can iterate over it like this:
```
{{#stooges}}
  <b>{{name}}</b>
{{/stooges}}
```

Which will result in the following output:
```
<b>Moe</b>
<b>Larry</b>
<b>Curly</b>
```

### Sample templates and template variables
In the test directory, there are a few examples to get you started.

For password reset and address verification messages, you can use the following template variables by default:
* `{{{link}}}` - the reset or verification link provided by the Parse Server (rendered as unescaped content)
* `{{appName}}` - as is defined in your Parse Server configuration object
* `{{username}}` - the Parse.User object's username property
* `{{email}}` - the Parse.User object's email property

Additional variables can be introduced by adding a callback.
An example is shown in the configuration above. The relevant Parse.User object is passed as an argument. The return value must be a plain object where the property names exactly match their template counterparts.
Note: the callback options only applies to the password reset and email address verification use cases.

For any other use case, you use the ```MailgunAdapter``` directly and pass any variable you need to the ```send``` method as explained in the code sample above.