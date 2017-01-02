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
    describe.only('creating a new instance', function () {
        function throwsError (args) {
            new MailgunAdapter(args);
        }

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
            const templateName = 'customEmail';
            const fromAddress = config.fromAddress;
            const recipient = 'test@test.com';
            const subject = 'Custom email alert';
            const variables = { appName: 'AwesomeApp', username: 'test' };
            const options = { templateName, subject, fromAddress, recipient, variables };
            const expectedArguments = { templateName, subject, fromAddress, recipient, variables, direct: true };

            const promise = adapter.send(options);
            expect(promise).to.be.an.instanceof(Promise);

            sinon.assert.calledWith(_sendMail, expectedArguments);
        });
    });

});
