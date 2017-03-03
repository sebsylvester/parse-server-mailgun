const mailgun = require('mailgun-js');
const mailcomposer = require('mailcomposer');
const Mustache = require('mustache');
const co = require('co');
const fs = require('fs');
const path = require('path');
const MailAdapter = require('./MailAdapter');

const ERRORS = {
    missing_configuration: 'MailgunAdapter requires configuration.',
    missing_mailgun_settings: 'MailgunAdapter requires valid API Key, domain and fromAddress.',
    bad_template_config: 'MailgunAdapter templates are not properly configured.',
    invalid_callback: 'MailgunAdapter template callback is not a function.',
    invalid_template_name: 'Invalid options object: missing templateName'
};

/**
 * MailAdapter implementation used by the Parse Server to send
 * password reset and email verification emails though Mailgun
 * @classnpm install --save-dev babel-preset-es2015-node
 */
class MailgunAdapter extends MailAdapter {
    constructor(options) {
        if (!options) {
            throw new Error(ERRORS.missing_configuration);
        }
        
        super(options);

        const { apiKey, domain, fromAddress } = options;
        if (!apiKey || !domain || !fromAddress) {
            throw new Error(ERRORS.missing_mailgun_settings);
        }

        const { templates } = options;
        if (!templates || Object.keys(templates).length === 0) {
            throw new Error(ERRORS.bad_template_config);
        }

        for (let name in templates) {
            const { subject, pathPlainText, callback } = templates[name];

            if (typeof subject !== 'string' || typeof pathPlainText !== 'string') {
                throw new Error(ERRORS.bad_template_config);
            }

            if (callback && typeof callback !== 'function') {
                throw new Error(ERRORS.invalid_callback);
            }
        }

        this.mailcomposer = mailcomposer;
        this.mailgun = mailgun({ apiKey, domain });
        this.fromAddress = fromAddress;
        this.templates = templates;
        this.cache = {};
        this.message = {};
        this.templateVars = {};
        this.selectedTemplate = {};
    }

    /**
     * Method to send MIME emails via Mailgun
     * @param {Object} options
     * @returns {Promise}
     */
    _sendMail(options) {
        let templateName = this.selectedTemplate.name = options.templateName;
        if (!templateName) {
            throw new Error(ERRORS.invalid_template_name);
        }

        let template = this.selectedTemplate.config = this.templates[templateName];
        if (!template) {
            throw new Error(`Could not find template with name ${templateName}`);
        }

        // The adapter is used directly by the user's code instead via Parse Server
        if (options.direct) {
            const { subject, fromAddress, recipient, variables } = options;
            
            if (!recipient) {
                throw new Error(`Cannot send email with template ${templateName} without a recipient`);
            }

            this.templateVars = variables || {};
            this.message = {
                from: fromAddress || this.fromAddress,
                to: recipient,
                subject: subject || template.subject
            };
        } else {
            const { link, appName, user } = options;
            const { callback } = template;
            
            let userVars;
            if (callback && typeof callback === 'function') {
                userVars = callback(user);
                userVars = this._validateUserVars(userVars);
            }

            this.templateVars = Object.assign({
                link,
                appName,
                username: user.get('username'),
                email: user.get('email')
            }, userVars);

            this.message = {
                from: this.fromAddress,
                to: user.get('email'),
                subject: template.subject
            };
        }

        return co(this._mailGenerator.bind(this)).catch(e => console.error(e));
    }

    /**
     * Generator function that handles that handles all the async operations:
     * template loading, MIME string building and email sending.
     */
    *_mailGenerator() {
        let compiled;
        let template = this.selectedTemplate.config;
        let templateName = this.selectedTemplate.name;
        let pathPlainText = template.pathPlainText;
        let pathHtml = template.pathHtml;
        let cachedTemplate = this.cache[templateName] = this.cache[templateName] || {};

        // Load plain-text version
        if (!cachedTemplate['text']) {
            let plainTextEmail = yield this._loadEmailTemplate(pathPlainText);
            plainTextEmail = plainTextEmail.toString('utf8');
            cachedTemplate['text'] = plainTextEmail;
        }

        // Compile plain-text template
        this.message.text = Mustache.render(cachedTemplate['text'], this.templateVars);

        // Load html version if available
        if (pathHtml) {
            if (!cachedTemplate['html']) {
                let htmlEmail = yield this._loadEmailTemplate(pathHtml);
                cachedTemplate['html'] = htmlEmail.toString('utf8');
            }
            // Add processed HTML to the message object
            this.message.html = Mustache.render(cachedTemplate['html'], this.templateVars);;
        }

        // Initialize mailcomposer with message
        const composer = this.mailcomposer(this.message);

        // Create MIME string
        const mimeString = yield new Promise((resolve, reject) => {
            composer.build((error, message) => {
                if (error) reject(error);
                resolve(message);
            });
        });

        // Assemble payload object for Mailgun
        const payload = {
            to: this.message.to,
            message: mimeString.toString('utf8')
        };

        return new Promise((resolve, reject) => {
            this.mailgun.messages().sendMime(payload, (error, body) => {
                if (error) reject(error);
                resolve(body);
            });
        });
    }

    /**
     * sendMail wrapper to send an email with password reset link
     * The options object would have the parameters link, appName, user
     * @param {Object} options
     * @returns {Promise}
     */
    sendPasswordResetEmail({ link, appName, user }) {
        return this._sendMail({ templateName: 'passwordResetEmail', link, appName, user });
    }

    /**
     * sendMail wrapper to send an email with an account verification link
     * The options object would have the parameters link, appName, user
     * @param {Object} options
     * @returns {Promise}
     */
    sendVerificationEmail({ link, appName, user }) {
        return this._sendMail({ templateName: 'verificationEmail', link, appName, user });
    }

    /**
     * sendMail wrapper to send general purpose emails
     * The options object would have the parameters:
     * - templateName: name of template to be used
     * - subject: overrides the default value
     * - fromAddress: overrides the default from address
     * - recipient: email's recipient
     * - variables: An object whose property names represent template variables,
     *              and whose values will replace the template variable placeholders
     * @param {Object} options
     * @returns {Promise}
     */
    send({ templateName, subject, fromAddress, recipient, variables }) {
        return this._sendMail({ templateName, subject, fromAddress, recipient, variables, direct: true });
    }

    /**
     * Simple Promise wrapper to asynchronously fetch the contents of a template.
     * @param {String} path
     * @returns {Promise}
     */
    _loadEmailTemplate(path) {
        return new Promise((resolve, reject) => {
            fs.readFile(path, (err, data) => {
                if (err) reject(err);
                resolve(data);
            });
        });
    }

    /**
     * Validator for user provided template variables
     * @param {Object} userVars
     * @returns {Object}
     */
    _validateUserVars(userVars) {
        const validUserVars = userVars && userVars.constructor === Object;
        // Fall back to an empty object if the callback did not return an Object instance
        return validUserVars ? userVars : {};
    }
}

module.exports = MailgunAdapter;