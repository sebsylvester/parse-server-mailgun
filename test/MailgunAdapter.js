const expect = require('chai').expect;
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const MailgunAdapter = require('../src/MailgunAdapter');

// Mock Parse.User object
const Parse = {
    User: class User {
        get(arg) {
            let value;
            switch (arg) {
                case 'username':
                    value = 'foo'
                    break;
                case 'email':
                    value = 'foo@bar.com'
                    break;
            }
            return value;
        }
    }
};
const user = new Parse.User();
const config = {
    fromAddress: 'AwesomeApp <noreply@awesomeapp.com>',
    domain: 'yourmailgundomain.mailgun.org',
    host: 'api.eu.mailgun.net',
    apiKey: 'secretApiKey',
    templates: {
        passwordResetEmail: {
            subject: 'Reset your password',
            pathPlainText: path.join(__dirname, 'email-templates/password_reset_email.txt'),
            pathHtml: path.join(__dirname, 'email-templates/password_reset_email.html'),
        },
        verificationEmail: {
            subject: 'Confirm your account',
            pathPlainText: path.join(__dirname, 'email-templates/verification_email.txt'),
            pathHtml: path.join(__dirname, 'email-templates/verification_email.html'),
            callback: () => {},
        },
        customAlert: {
            subject: 'Important notice about your account',
            pathPlainText: path.join(__dirname, 'email-templates/password_reset_email.txt'),
            pathHtml: path.join(__dirname, 'email-templates/password_reset_email.html'),
        },
        customEmail: {
            subject: 'Test custom email template',
            pathPlainText: path.join(__dirname, 'email-templates/custom_email.txt'),
            pathHtml: path.join(__dirname, 'email-templates/custom_email.html'),
            extra: {
                attachments: [
                    {
                        cid: '1px-trans-image',
                        encoding: 'base64',
                        filename: 'trans.gif',
                        path: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP',
                    }
                ],
                replyTo: 'reply@test.com',
            },
        },
        customEmailWithCallback: {
            subject: 'Test custom email template with callback',
            pathPlainText: path.join(__dirname, 'email-templates/custom_email.txt'),
            pathHtml: path.join(__dirname, 'email-templates/custom_email.html'),
            callback: () => new Promise((resolve) => {
                resolve({
                    appName: 'correctAppName'
                });
            })
        }
    }
};

describe('MailgunAdapter', function () {
    describe('creating a new instance', function () {
        function throwsError (args) {
            new MailgunAdapter(args);
        }

        it('should fail if called without a configuration object', function () {
            expect(throwsError.bind(null, undefined)).to.throw('MailgunAdapter requires configuration.');
        });

        it('should fail if not called with an apiKey, domain or fromAddress', function () {
            expect(throwsError.bind(null, { domain: '.', fromAddress: '.' })).to.throw('MailgunAdapter requires valid API Key, domain and fromAddress.');
            expect(throwsError.bind(null, { apiKey: '.', fromAddress: '.' })).to.throw('MailgunAdapter requires valid API Key, domain and fromAddress.');
            expect(throwsError.bind(null, { apiKey: '.', domain: '.' })).to.throw('MailgunAdapter requires valid API Key, domain and fromAddress.');
        });

        it('should fail without properly configured templates option', function () {
            const test_1 = { apiKey: '.', domain: '.', fromAddress: '.' };
            expect(throwsError.bind(null, test_1)).to.throw('MailgunAdapter templates are not properly configured.');

            const test_2 = {
                apiKey: '.', domain: '.', fromAddress: '.',
                templates: { passwordResetEmail: {}, verificationEmail: {} }
            };
            expect(throwsError.bind(null, test_2)).to.throw('MailgunAdapter templates are not properly configured.');

            const test_3 = {
                apiKey: '.', domain: '.', fromAddress: '.',
                templates: {
                    passwordResetEmail: { subject: '.' },
                    verificationEmail: { subject: '.' }
                }
            };
            expect(throwsError.bind(null, test_3)).to.throw('MailgunAdapter templates are not properly configured.');

            const test_4 = {
                apiKey: '.', domain: '.', fromAddress: '.',
                templates: {
                    passwordResetEmail: { pathPlainText: '.' },
                    verificationEmail: { pathPlainText: '.' }
                }
            };
            expect(throwsError.bind(null, test_4)).to.throw('MailgunAdapter templates are not properly configured.');

            const test_5 = {
                apiKey: '.', domain: '.', fromAddress: '.',
                templates: {
                    passwordResetEmail: { pathPlainText: '.' },
                    verificationEmail: { pathPlainText: '.' }
                }
            };
            expect(throwsError.bind(null, test_5)).to.throw('MailgunAdapter templates are not properly configured.');

            const test_6 = {
                apiKey: '.', domain: '.', fromAddress: '.',
                templates: {
                    passwordResetEmail: {
                        subject: 'Reset your password',
                        pathPlainText: '.',
                        callback: {}
                    },
                    verificationEmail: {
                        subject: 'Confirm your email',
                        pathPlainText: '.'
                     }
                }
            };
            expect(throwsError.bind(null, test_6)).to.throw('MailgunAdapter template callback is not a function.');
        });

        it('should succeed with properly configured templates option', function (done) {
            try {
                const adapter = new MailgunAdapter({
                    apiKey: '.', domain: '.', fromAddress: '.',
                    templates: {
                        passwordResetEmail: {
                            subject: 'Reset your password',
                            pathPlainText: '.'
                            // pathHtml and callback are optional
                        },
                        verificationEmail: {
                            subject: 'Confirm your email',
                            pathPlainText: '.'
                            // pathHtml and callback are optional
                        }
                    }
                });
                expect(adapter).to.be.an.instanceof(MailgunAdapter);
                done();
            } catch (e) {
                console.error(e);
                done();
            }
        });
    });

    describe('#sendPasswordResetEmail()', function () {
        let _sendMail;

        before(function () {
            _sendMail = sinon.spy(MailgunAdapter.prototype, '_sendMail');
        });

        after(function () {
            _sendMail.restore();
        });

        it('should invoke #_sendMail() with the correct arguments and return a promise', function () {
            const adapter = new MailgunAdapter(config);
            adapter.mailgun.messages = () => {
                return {
                    sendMime(payload, callback) {
                        callback(null, {});
                    }
                }
            }
            const link = 'http://password-reset-link';
            const appName = 'AwesomeApp';
            const templateName = 'passwordResetEmail';

            const options = { link, appName, user };
            const expectedArguments = { templateName, link, appName, user };

            // The Parse Server will invoke this adapter method with similar options
            const promise = adapter.sendPasswordResetEmail(options);
            expect(promise).to.be.an.instanceof(Promise);

            sinon.assert.calledWith(_sendMail, expectedArguments);
        });
    });

    describe('#sendVerificationEmail()', function () {
        let _sendMail;

        before(function () {
            _sendMail = sinon.spy(MailgunAdapter.prototype, '_sendMail');
        });

        after(function () {
            _sendMail.restore();
        });

        it('should invoke #_sendMail() with the correct arguments and return a promise', function () {
            const adapter = new MailgunAdapter(config);
            adapter.mailgun.messages = () => {
                return {
                    sendMime(payload, callback) {
                        callback(null, {});
                    }
                }
            }
            const link = 'http://verify-account-link';
            const appName = 'AwesomeApp';
            const templateName = 'verificationEmail';

            const options = { link, appName, user };
            const expectedArguments = { templateName, link, appName, user };

            // The Parse Server will invoke this adapter method with similar options
            const promise = adapter.sendVerificationEmail(options);
            expect(promise).to.be.an.instanceof(Promise);

            sinon.assert.calledWith(_sendMail, expectedArguments);
        });
    });

    describe('#send()', function () {
        let _sendMail;

        before(function () {
            _sendMail = sinon.spy(MailgunAdapter.prototype, '_sendMail');
        });

        after(function () {
            _sendMail.restore();
        });

        it('should invoke #_sendMail() with the correct arguments and return a promise', function () {
            const adapter = new MailgunAdapter(config);
            adapter.mailgun.messages = () => {
                return {
                    sendMime(payload, callback) {
                        callback(null, {});
                    }
                }
            }
            const templateName = 'customEmail';
            const fromAddress = config.fromAddress;
            const recipient = 'test@test.com';
            const subject = 'Custom email alert';
            const variables = { appName: 'AwesomeApp', username: 'test' };
            const extra = {};
            const options = { templateName, subject, fromAddress, recipient, variables, extra };
            const expectedArguments = { templateName, subject, fromAddress, recipient, variables, extra, direct: true };

            const promise = adapter.send(options);
            expect(promise).to.be.an.instanceof(Promise);

            sinon.assert.calledWith(_sendMail, expectedArguments);
        });

        it('should generate a payload with replyTo and attachment', function (done) {
            const adapter = new MailgunAdapter(config);
            adapter.mailgun.messages = () => {
                return {
                    sendMime(payload, callback) {
                        callback(null, payload);
                    }
                }
            }
            const templateName = 'customEmail';
            const fromAddress = config.fromAddress;
            const recipient = 'test@test.com';
            const subject = 'Custom email alert';
            const variables = { appName: 'AwesomeApp', username: 'test' };
            const extra = {};
            const options = { templateName, subject, fromAddress, recipient, variables, extra };
            const expectedArguments = { templateName, subject, fromAddress, recipient, variables, extra, direct: true };

            const promise = adapter.send(options);

            sinon.assert.calledWith(_sendMail, expectedArguments);
            promise
                .then((payload) => {
                    expect(payload.message).to.match(/Reply-To: reply@test\.com/, 'Payload does not contain replyTo');
                    expect(payload.message).to.match(/Content-Disposition: attachment/, 'Payload does not contain attachment');
                    done();
                })
                .catch(done)
        });
    });

    describe('#_sendMail', function () {
        it('should throw an exception if invoked with missing template name', function() {
            const adapter = new MailgunAdapter(config);
            expect(adapter._sendMail.bind(adapter, {}))
                .to.throw('Invalid options object: missing templateName');
        });

        it('should throw an exception if the template name is not defined in the configuration', function() {
            const adapter = new MailgunAdapter(config);
            expect(adapter._sendMail.bind(adapter, { templateName: 'foo' }))
                .to.throw('Could not find template with name foo');
        });

        it('should throw an exception if the template name is not defined in the configuration', function() {
            const adapter = new MailgunAdapter(config);
            expect(adapter._sendMail.bind(adapter, { templateName: 'foo', direct: true }))
                .to.throw('Could not find template with name foo');
        });

        it('should throw an exception if recipient is undefined', function() {
            const adapter = new MailgunAdapter(config);
            expect(adapter._sendMail.bind(adapter, { templateName: 'customAlert', direct: true }))
                .to.throw('Cannot send email with template customAlert without a recipient');
        });

        it('should catch exceptions thrown during mail generation', function(done) {
            const adapter = new MailgunAdapter(config);
            sinon.stub(adapter, 'mailcomposer').callsFake(() => {
                return { build: (callback) => {
                    callback(new Error('Composing message failed', null));
                }};
            });
            const options = {
                templateName: 'passwordResetEmail',
                user: new Parse.User(),
                link: 'https://foo.com',
                appName: 'AwesomeApp'
            }

            sinon.stub(console, 'error').callsFake((error) => {
                expect(error.message).to.equal('Composing message failed');
                adapter.mailcomposer.restore();
                console.error.restore();
                done();
            });

            adapter._sendMail(options);
        });

        it('should log exceptions thrown during mail generation (direct: true)', function(done) {
            const adapter = new MailgunAdapter(config);
            sinon.stub(adapter, 'mailcomposer').callsFake(() => {
                return { build: (callback) => {
                    callback(new Error('Composing message failed', null));
                }};
            });
            const options = {
                templateName: 'customAlert',
                direct: true,
                recipient: 'foo@bar.com'
            }

            sinon.stub(console, 'error').callsFake((error) => {
                expect(error.message).to.equal('Composing message failed');
                adapter.mailcomposer.restore();
                console.error.restore();
                done();
            });

            adapter._sendMail(options);
        });
    });

    describe('#_mailGenerator', function () {
        it('should load the plain text template async', function (done) {
            const adapter = new MailgunAdapter(config);
            const selectedTemplate = {
                config: config.templates.passwordResetEmail,
                name: 'passwordResetEmail'
            };
            const args = { templateVars: {}, message: {}, selectedTemplate };

            const pathPlainText = selectedTemplate.config.pathPlainText;
            const iterator = adapter._mailGenerator(args);
            const promise = iterator.next().value;

            promise.then(res => {
                const textTemplate = fs.readFileSync(pathPlainText);
                expect(res.toString('utf8')).to.equal(textTemplate.toString('utf8'));
                done();
            });
        });

        it('should use the cached plain text template when available', function (done) {
            const adapter = new MailgunAdapter(config);
            const templateVars = {
                link: 'https://foo.com/',
                appName: 'AwesomeApp',
                username: 'me',
                email: 'me@foo.com'
            };
            const selectedTemplate = {
                config: config.templates.passwordResetEmail,
                name: 'passwordResetEmail'
            };

            const pathPlainText = selectedTemplate.config.pathPlainText;
            adapter.cache = {
                passwordResetEmail: {
                    text: fs.readFileSync(pathPlainText).toString('utf8')
                }
            };
            const args = { templateVars, message: {}, selectedTemplate };

            const pathHtml = selectedTemplate.config.pathHtml;
            const iterator = adapter._mailGenerator(args);
            const promise = iterator.next().value;

            promise.then(res => {
                // Since the plain text template is cached, the first yield should
                // be the promise that wraps the loading of the html template.
                const htmlTemplate = fs.readFileSync(pathHtml);
                expect(res.toString('utf8')).to.equal(htmlTemplate.toString('utf8'));
                done();
            });
        });

        it('should load the html template async', function (done) {
            const adapter = new MailgunAdapter(config);
            const templateVars = {
                link: 'https://foo.com/',
                appName: 'AwesomeApp',
                username: 'me',
                email: 'me@foo.com'
            };
            const selectedTemplate = {
                config: config.templates.passwordResetEmail,
                name: 'passwordResetEmail'
            };
            const pathHtml = selectedTemplate.config.pathHtml;
            const args = { templateVars, message: {}, selectedTemplate };

            const iterator = adapter._mailGenerator(args);
            const promise = iterator.next().value;

            promise.then(res => {
                return iterator.next(res).value;
            }).then(res => {
                const htmlTemplate = fs.readFileSync(pathHtml);
                expect(res.toString('utf8')).to.equal(htmlTemplate.toString('utf8'));
                return iterator.next(res).value;
            }).then(() => {
                // Add another step to cover the caching statement
                done();
            });
        });

        it('should use the cached html template when available', function (done) {
            const adapter = new MailgunAdapter(config);
            const templateVars = {
                link: 'https://foo.com/',
                appName: 'AwesomeApp',
                username: 'me',
                email: 'me@foo.com'
            };
            const selectedTemplate = {
                config: config.templates.passwordResetEmail,
                name: 'passwordResetEmail'
            };

            const pathPlainText = selectedTemplate.config.pathPlainText;
            const pathHtml = selectedTemplate.config.pathHtml;
            adapter.cache = {
                passwordResetEmail: {
                    text: fs.readFileSync(pathPlainText).toString('utf8'),
                    html: fs.readFileSync(pathHtml).toString('utf8')
                }
            }

            const args = { templateVars, message: {}, selectedTemplate };
            const iterator = adapter._mailGenerator(args);
            const promise = iterator.next().value;

            promise.then(res => {
                // Since the plain text and html template are cached, the first yield should
                // be the promise that wraps the composing of the MIME-string
                const mimeString = res.toString('utf8');
                expect(/MIME-Version: 1.0/.test(mimeString)).to.be.true;
                done();
            }).catch(error => {
                console.error(error);
                done();
            });
        });

        it('should catch errors thrown during the composing of the MIME string', function (done) {
            const _config = Object.assign({}, config);
            // Skip html template loading
            delete _config.templates.passwordResetEmail.pathHtml;
            const adapter = new MailgunAdapter(_config);

            sinon.stub(adapter, 'mailcomposer').callsFake(() => {
                return { build: (callback) => {
                    callback(new Error('Composing message failed', null));
                }};
            });

            const templateVars = {
                link: 'https://foo.com/',
                appName: 'AwesomeApp',
                username: 'me',
                email: 'me@foo.com'
            };
            const selectedTemplate = {
                config: _config.templates.passwordResetEmail,
                name: 'passwordResetEmail'
            };

            const pathPlainText = selectedTemplate.config.pathPlainText;
            adapter.cache = {
                passwordResetEmail: {
                    text: fs.readFileSync(pathPlainText).toString('utf8')
                }
            }

            const args = { templateVars, message: {}, selectedTemplate };
            const iterator = adapter._mailGenerator(args);
            const promise = iterator.next().value;

            promise.catch(error => {
                expect(error.message).to.equal('Composing message failed');
                adapter.mailcomposer.restore();
                done();
            });
        });

        it('should invoke sendMime with a payload', function (done) {
            const _config = Object.assign({}, config);
            // Skip html template loading
            delete _config.templates.passwordResetEmail.pathHtml;
            const adapter = new MailgunAdapter(_config);

            sinon.stub(adapter.mailgun, 'messages').callsFake(() => {
                return { sendMime: (payload, callback) => {
                    expect(/MIME-Version: 1.0/.test(payload.message)).to.be.true;
                    expect(payload.to).to.equal('foo@bar.com');
                    callback(null, { success: true });
                }};
            });
            const message = {
                from: _config.fromAddress,
                to: 'foo@bar.com',
                subject: 'reset password'
            };
            const templateVars = {
                link: 'https://foo.com/',
                appName: 'AwesomeApp',
                username: 'me',
                email: 'me@foo.com'
            };
            const selectedTemplate = {
                config: _config.templates.passwordResetEmail,
                name: 'passwordResetEmail'
            };

            const pathPlainText = selectedTemplate.config.pathPlainText;
            adapter.cache = {
                passwordResetEmail: {
                    text: fs.readFileSync(pathPlainText).toString('utf8')
                }
            }

            const args = { templateVars, message, selectedTemplate };
            const iterator = adapter._mailGenerator(args);
            const promise = iterator.next().value;

            promise.then(res => {
                return iterator.next(res).value;
            }).then(() => {
                adapter.mailgun.messages.restore();
                done();
            });
        });

        it('should use the template variables from the callback', function (done) {
          const adapter = new MailgunAdapter(config);
          const selectedTemplate = {
            config: config.templates.customEmailWithCallback,
            name: 'customEmail'
          };
          const args = { templateVars: { answer: 42, appName: 'wrongAppName' }, message: {}, selectedTemplate };

          const iterator = adapter._mailGenerator(args);
          const promise = iterator.next().value;

          promise
            .then(res => {
                expect(res.appName).to.eq("correctAppName");
                return iterator.next(res).value;
            })
            .then(res => {
                // Text template
                return iterator.next(res).value;
            })
            .then(res => {
                // HTML template
                return iterator.next(res).value;
            })
            .then(res => {
                // HTML template with replace placeholders
                expect(res.toString('utf8')).to.contains('correctAppName');
            });
            done();
        });

        it('should catch errors thrown during the sending of the email', function (done) {
            const _config = Object.assign({}, config);
            // Skip html template loading
            delete _config.templates.passwordResetEmail.pathHtml;
            const adapter = new MailgunAdapter(_config);

            sinon.stub(adapter.mailgun, 'messages').callsFake(() => {
                return { sendMime: (payload, callback) => {
                    expect(/MIME-Version: 1.0/.test(payload.message)).to.be.true;
                    expect(payload.to).to.equal('foo@bar.com');
                    callback(new Error('Sending email failed', null));
                }};
            });
            const message = {
                from: _config.fromAddress,
                to: 'foo@bar.com',
                subject: 'reset password'
            };
            const templateVars = {
                link: 'https://foo.com/',
                appName: 'AwesomeApp',
                username: 'me',
                email: 'me@foo.com'
            };
            const selectedTemplate = {
                config: _config.templates.passwordResetEmail,
                name: 'passwordResetEmail'
            };

            const pathPlainText = selectedTemplate.config.pathPlainText;
            adapter.cache = {
                passwordResetEmail: {
                    text: fs.readFileSync(pathPlainText).toString('utf8')
                }
            }

            const args = { templateVars, message, selectedTemplate };
            const iterator = adapter._mailGenerator(args);
            const promise = iterator.next().value;

            promise.then(res => {
                return iterator.next(res).value;
            }).catch(error => {
                expect(error.message).to.equal('Sending email failed');
                adapter.mailgun.messages.restore();
                done();
            });
        });
    });

    describe('#_loadEmailTemplate', function () {
        it('should reject with an error if the file could not be loaded from disk', function(done) {
            const adapter = new MailgunAdapter(config);
            const templatePath = path.join(__dirname, 'email-templates/foo.txt');

            adapter._loadEmailTemplate(templatePath).catch(err => {
                expect(err.code).to.equal('ENOENT');
                done();
            });
        });

        it('should resolve with the template when the file is loaded from disk', function(done) {
            const adapter = new MailgunAdapter(config);
            const templatePath = path.join(__dirname, 'email-templates/password_reset_email.txt');

            adapter._loadEmailTemplate(templatePath).then(template => {
                expect(template).to.be.ok;
                done();
            });
        });
    });

    describe('#_validateUserVars', function () {
        it('should return the userVars when valid', function() {
            const adapter = new MailgunAdapter(config);
            const userVars = { foo: 'bar' };
            expect(adapter._validateUserVars(userVars)).to.deep.equal({ foo: 'bar' });
        });

        it('should return an empty object when userVars are invalid', function() {
            const adapter = new MailgunAdapter(config);
            const userVars = 'foo';
            expect(adapter._validateUserVars(userVars)).to.deep.equal({});
        });
    });
});
