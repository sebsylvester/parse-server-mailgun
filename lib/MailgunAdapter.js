'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MailAdapter = require('parse-server/lib/Adapters/Email/MailAdapter');
var mailgun = require('mailgun-js');
var mailcomposer = require('mailcomposer');
var _template = require('lodash.template');
var co = require('co');
var fs = require('fs');
var path = require('path');

/**
 * MailAdapter implementation used by the Parse Server to send
 * password reset and email verification emails though Mailgun
 * @class
 */

var MailgunAdapter = function (_MailAdapter$default) {
    _inherits(MailgunAdapter, _MailAdapter$default);

    function MailgunAdapter() {
        var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

        _classCallCheck(this, MailgunAdapter);

        var _this = _possibleConstructorReturn(this, (MailgunAdapter.__proto__ || Object.getPrototypeOf(MailgunAdapter)).call(this, options));

        var apiKey = options.apiKey;
        var domain = options.domain;
        var fromAddress = options.fromAddress;

        if (!apiKey || !domain || !fromAddress) {
            throw new Error('MailgunAdapter requires valid API Key, domain and fromAddress.');
        }

        var _options$templates = options.templates;
        var templates = _options$templates === undefined ? {} : _options$templates;

        ['passwordResetEmail', 'verificationEmail'].forEach(function (key) {
            var _ref = templates[key] || {};

            var subject = _ref.subject;
            var pathPlainText = _ref.pathPlainText;
            var callback = _ref.callback;

            if (typeof subject !== 'string' || typeof pathPlainText !== 'string') throw new Error('MailgunAdapter templates are not properly configured.');

            if (callback && typeof callback !== 'function') throw new Error('MailgunAdapter template callback is not a function.');
        });

        _this.mailgun = mailgun({ apiKey: apiKey, domain: domain });
        _this.fromAddress = fromAddress;
        _this.templates = templates;
        _this.cache = {};
        return _this;
    }

    // TODO update this
    /**
     * Method to send MIME emails via Mailgun
     * The options object would have the parameters:
     * - subject: email's subject
     * - link: to reset password or verify email address
     * - user: the Parse.User object
     * - pathPlainText: path to plain-text version of email template
     * - pathHtml: path to html version of email template
     * @param {Object} options
     * @returns {Promise}
     */


    _createClass(MailgunAdapter, [{
        key: '_sendMail',
        value: function _sendMail(options) {
            var _this2 = this;

            var self = this;
            var message = {},
                templateVars = {},
                templateName = options.templateName;

            if (!templateName) throw new Error('Invalid options object: missing templateName');

            var template = this.templates[templateName];

            if (!template) throw new Error('Could not find template with name ' + templateName);

            // The adapter is used directly by the user's code instead via Parse Server
            if (options.direct) {
                var subject = options.subject;
                var fromAddress = options.fromAddress;
                var recipient = options.recipient;
                var variables = options.variables;

                if (!subject && !template.subject) throw new Error('Cannot send email with template ' + templateName + ' without a subject');
                if (!recipient) throw new Error('Cannot send email with template ' + templateName + ' without a recipient');

                templateVars = variables;

                message = {
                    from: fromAddress || this.fromAddress,
                    to: recipient,
                    subject: subject || template.subject
                };
            } else {
                var link = options.link;
                var appName = options.appName;
                var user = options.user;
                var callback = template.callback;

                var userVars = void 0;

                if (callback && typeof callback === 'function') {
                    userVars = callback(user);
                    // If custom user variables are not packaged in an object, ignore it
                    var validUserVars = userVars && userVars.constructor && userVars.constructor.name === 'Object';
                    userVars = validUserVars ? userVars : {};
                }

                templateVars = Object.assign({
                    link: link,
                    appName: appName,
                    username: user.get('username'),
                    email: user.get('email')
                }, userVars);

                message = {
                    from: this.fromAddress,
                    to: user.get('email'),
                    subject: template.subject
                };
            }

            return co(regeneratorRuntime.mark(function _callee() {
                var compiled, pathPlainText, pathHtml, cachedTemplate, plainTextEmail, composer, mimeString, payload;
                return regeneratorRuntime.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                compiled = void 0;
                                pathPlainText = template.pathPlainText;
                                pathHtml = template.pathHtml;
                                cachedTemplate = self.cache[templateName] = self.cache[templateName] || {};

                                // Load plain-text version

                                if (cachedTemplate['text']) {
                                    _context.next = 10;
                                    break;
                                }

                                _context.next = 7;
                                return self.loadEmailTemplate(pathPlainText);

                            case 7:
                                plainTextEmail = _context.sent;

                                plainTextEmail = plainTextEmail.toString('utf8');
                                cachedTemplate['text'] = plainTextEmail;

                            case 10:

                                // Compile plain-text template
                                compiled = _template(cachedTemplate['text'], { interpolate: /{{([\s\S]+?)}}/g });
                                // Add processed text to the message object
                                message.text = compiled(templateVars);

                                // Load html version if available

                                if (!pathHtml) {
                                    _context.next = 19;
                                    break;
                                }

                                if (cachedTemplate['html']) {
                                    _context.next = 17;
                                    break;
                                }

                                _context.next = 16;
                                return self.loadEmailTemplate(pathHtml);

                            case 16:
                                cachedTemplate['html'] = _context.sent;

                            case 17:

                                // Compile html template
                                compiled = _template(cachedTemplate['html'], { interpolate: /{{([\s\S]+?)}}/g });
                                // Add processed HTML to the message object
                                message.html = compiled(templateVars);

                            case 19:

                                // Initialize mailcomposer with message
                                composer = mailcomposer(message);

                                // Create MIME string

                                _context.next = 22;
                                return new Promise(function (resolve, reject) {
                                    composer.build(function (error, message) {
                                        if (error) reject(error);
                                        resolve(message);
                                    });
                                });

                            case 22:
                                mimeString = _context.sent;


                                // Assemble payload object for Mailgun
                                payload = {
                                    to: message.to,
                                    message: mimeString.toString('utf8')
                                };
                                return _context.abrupt('return', payload);

                            case 25:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            })).then(function (payload) {
                return new Promise(function (resolve, reject) {
                    _this2.mailgun.messages().sendMime(payload, function (error, body) {
                        if (error) reject(error);
                        resolve(body);
                    });
                });
            }, function (error) {
                console.error(error);
            });
        }

        /**
         * _sendMail wrapper to send an email with password reset link
         * The options object would have the parameters link, appName, user
         * @param {Object} options
         * @returns {Promise}
         */

    }, {
        key: 'sendPasswordResetEmail',
        value: function sendPasswordResetEmail(_ref2) {
            var link = _ref2.link;
            var appName = _ref2.appName;
            var user = _ref2.user;

            return this._sendMail({ templateName: 'passwordResetEmail', link: link, appName: appName, user: user });
        }

        /**
         * _sendMail wrapper to send an email with an account verification link
         * The options object would have the parameters link, appName, user
         * @param {Object} options
         * @returns {Promise}
         */

    }, {
        key: 'sendVerificationEmail',
        value: function sendVerificationEmail(_ref3) {
            var link = _ref3.link;
            var appName = _ref3.appName;
            var user = _ref3.user;

            return this._sendMail({ templateName: 'verificationEmail', link: link, appName: appName, user: user });
        }

        /**
         * _sendMail wrapper to send general purpose emails
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

    }, {
        key: 'send',
        value: function send(_ref4) {
            var templateName = _ref4.templateName;
            var subject = _ref4.subject;
            var fromAddress = _ref4.fromAddress;
            var recipient = _ref4.recipient;
            var _ref4$variables = _ref4.variables;
            var variables = _ref4$variables === undefined ? {} : _ref4$variables;

            return this._sendMail({ templateName: templateName, subject: subject, fromAddress: fromAddress, recipient: recipient, variables: variables, direct: true });
        }

        /**
         * Simple Promise wrapper to asynchronously fetch the contents of a template.
         * @param {String} path
         * @returns {Promise}
         */

    }, {
        key: 'loadEmailTemplate',
        value: function loadEmailTemplate(path) {
            return new Promise(function (resolve, reject) {
                fs.readFile(path, function (err, data) {
                    if (err) reject(err);
                    resolve(data);
                });
            });
        }
    }]);

    return MailgunAdapter;
}(MailAdapter.default);

module.exports = MailgunAdapter;