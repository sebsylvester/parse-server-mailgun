const expect = require('chai').expect;
const MailAdapter = require('../src/MailAdapter');

describe('MailgunAdapter', function () {
    const adapter = new MailAdapter()

    it('should have a method called sendMail', function () {
        expect(adapter.sendMail).to.be.a('function');
        expect(adapter.sendMail()).to.be.undefined;
    });

    it('should have a method called sendVerificationEmail', function () {
        expect(adapter.sendVerificationEmail).to.be.a('function');
        expect(adapter.sendVerificationEmail({ link: 'link', appName: 'appName', user: {} })).to.be.undefined;
        expect(true).to.be.ok;
    });

    it('should have a method called sendPasswordResetEmail', function () {
        expect(adapter.sendPasswordResetEmail).to.be.a('function');
        expect(adapter.sendPasswordResetEmail({ link: 'link', appName: 'appName', user: {} })).to.be.undefined;
    });
});