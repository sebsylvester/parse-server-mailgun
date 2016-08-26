require("babel-polyfill");

const MailgunAdapter = require('../src/MailgunAdapter');
const expect = require('chai').expect;
const sinon = require('sinon');
const path = require('path');
// Mock Parse.User object
const Parse = {
    User: class User {
        get() { return 'foo' }
    }
};
const user = new Parse.User();
const config = {
    fromAddress: 'AwesomeApp <noreply@awesomeapp.com>',
    domain: 'yourmailgundomain.mailgun.org',
    apiKey: 'secretApiKey',
    templates: {
        passwordResetEmail: {
            subject: 'Reset your password',
            pathPlainText: path.join(__dirname, 'email-templates/password_reset_email.txt'),
            pathHtml: path.join(__dirname, 'email-templates/password_reset_email.html'),
            callback: (user) => {}
        },
        verificationEmail: {
            subject: 'Confirm your account',
            pathPlainText: path.join(__dirname, 'email-templates/verification_email.txt'),
            pathHtml: path.join(__dirname, 'email-templates/verification_email.html'),
            callback: (user) => {}
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
        },
    }
};

describe('MailgunAdapter', function () {
    describe('creating a new instance', function () {
        it('should fail if not called with an apiKey, domain or fromAddress', function () {
            try {
                new MailgunAdapter({ domain: '.', fromAddress: '.' });
            } catch (error) {
                expect(error.message).to.equal('MailgunAdapter requires valid API Key, domain and fromAddress.');
            }

            try {
                new MailgunAdapter({ apiKey: '.', fromAddress: '.' });
            } catch (error) {
                expect(error.message).to.equal('MailgunAdapter requires valid API Key, domain and fromAddress.');
            }

            try {
                new MailgunAdapter({ apiKey: '.', domain: '.' });
            } catch (error) {
                expect(error.message).to.equal('MailgunAdapter requires valid API Key, domain and fromAddress.');
            }
        });

        it('should fail without properly configured templates option', function () {
            try {
                new MailgunAdapter({ apiKey: '.', domain: '.', fromAddress: '.' });
            } catch (error) {
                expect(error.message).to.equal('MailgunAdapter templates are not properly configured.');
            }

            try {
                new MailgunAdapter({ apiKey: '.', domain: '.', fromAddress: '.',
                    templates: {
                        passwordResetEmail: {},
                        verificationEmail: {}
                    }
                });
            } catch (error) {
                expect(error.message).to.equal('MailgunAdapter templates are not properly configured.');
            }

            try {
                new MailgunAdapter({ apiKey: '.', domain: '.', fromAddress: '.',
                    templates: {
                        passwordResetEmail: {
                            subject: '.'
                        },
                        verificationEmail: {
                            subject: '.'
                        }
                    }
                });
            } catch (error) {
                expect(error.message).to.equal('MailgunAdapter templates are not properly configured.');
            }

            try {
                new MailgunAdapter({ apiKey: '.', domain: '.', fromAddress: '.',
                    templates: {
                        passwordResetEmail: {
                            pathPlainText: '.'
                        },
                        verificationEmail: {
                            pathPlainText: '.'
                        }
                    }
                });
            } catch (error) {
                expect(error.message).to.equal('MailgunAdapter templates are not properly configured.');
            }

            try {
                new MailgunAdapter({ apiKey: '.', domain: '.', fromAddress: '.',
                    templates: {
                        passwordResetEmail: {
                            pathPlainText: '.'
                        },
                        verificationEmail: {
                            pathPlainText: '.'
                        }
                    }
                });
            } catch (error) {
                expect(error.message).to.equal('MailgunAdapter templates are not properly configured.');
            }

            try {
                new MailgunAdapter({ apiKey: '.', domain: '.', fromAddress: '.',
                    templates: {
                        passwordResetEmail: {
                            subject: 'Reset your password',
                            pathPlainText: '.',
                            callback: ''
                        },
                        verificationEmail: {
                            subject: 'Confirm your email',
                            pathPlainText: '.'
                        }
                    }
                });
            } catch (error) {
                expect(error.message).to.equal('MailgunAdapter template callback is not a function.');
            }
        });

        it('should succeed with properly configured templates option', function (done) {
            try {
                const adapter = new MailgunAdapter({
                    apiKey: '.',
                    domain: '.',
                    fromAddress: '.',
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

        it('should invoke #_sendMail() with the correct arguments', function () {
            const adapter = new MailgunAdapter(config);
            const link = 'http://password-reset-link';
            const appName = 'AwesomeApp';
            const templateConfig = adapter.templates.passwordResetEmail;

            const options = { link, appName, user };
            const expectedArguments = { link, appName, user, templateConfig };

            // The Parse Server will invoke this adapter method with similar options
            adapter.sendPasswordResetEmail(options);

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

        it('should invoke #_sendMail() with the correct arguments', function () {
            const adapter = new MailgunAdapter(config);
            const link = 'http://verify-account-link';
            const appName = 'AwesomeApp';
            const templateConfig = adapter.templates.verificationEmail;

            const options = { link, appName, user };
            const expectedArguments = { link, appName, user, templateConfig };

            // The Parse Server will invoke this adapter method with similar options
            adapter.sendVerificationEmail(options);

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

        it('should invoke #_sendMail() with the correct arguments', function () {
            const adapter = new MailgunAdapter(config);
            const templateName = 'customEmail';
            const fromAddress = config.fromAddress;
            const recipient = 'test@test.com';
            const variables = { appName: 'AwesomeApp', username: 'test' };
            const options = {templateName, fromAddress, recipient, variables};

            const promise = adapter.send(options);
            expect(promise).to.be.an.instanceof(Promise);
        });
    });

});
