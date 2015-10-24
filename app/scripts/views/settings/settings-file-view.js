'use strict';

var Backbone = require('backbone'),
    FeatureDetector = require('../../util/feature-detector'),
    PasswordDisplay = require('../../util/password-display'),
    Alerts = require('../../util/alerts'),
    RuntimeInfo = require('../../util/runtime-info'),
    Links = require('../../const/links'),
    kdbxweb = require('kdbxweb'),
    FileSaver = require('filesaver');

var SettingsAboutView = Backbone.View.extend({
    template: require('templates/settings/settings-file.html'),

    events: {
        'click .settings__file-button-save-file': 'saveToFile',
        'click .settings__file-button-export-xml': 'exportAsXml',
        'click .settings__file-button-save-dropbox': 'saveToDropbox',
        'change #settings__file-key-file': 'keyFileChange',
        'mousedown #settings__file-file-select-link': 'triggerSelectFile',
        'change #settings__file-file-select': 'fileSelected',
        'focus #settings__file-master-pass': 'focusMasterPass',
        'blur #settings__file-master-pass': 'blurMasterPass',
        'blur #settings__file-name': 'blurName',
        'blur #settings__file-def-user': 'blurDefUser',
        'change #settings__file-trash': 'changeTrash',
        'blur #settings__file-hist-len': 'blurHistoryLength',
        'blur #settings__file-hist-size': 'blurHistorySize',
        'blur #settings__file-key-rounds': 'blurKeyRounds'
    },

    initialize: function() {
    },

    render: function() {
        this.renderTemplate({
            cmd: FeatureDetector.actionShortcutSymbol(true),
            supportFiles: RuntimeInfo.launcher,
            desktopLink: Links.Desktop,

            name: this.model.get('name'),
            path: this.model.get('path'),
            password: PasswordDisplay.present(this.model.get('passwordLength')),
            defaultUser: this.model.get('defaultUser'),
            recycleBinEnabled: this.model.get('recycleBinEnabled'),
            historyMaxItems: this.model.get('historyMaxItems'),
            historyMaxSize: Math.round(this.model.get('historyMaxSize') / 1024 / 1024),
            keyEncryptionRounds: this.model.get('keyEncryptionRounds')
        });
        if (!this.model.get('created')) {
            this.$el.find('.settings__file-master-pass-warning').toggle(this.model.get('passwordChanged'));
        }
        this.renderKeyFileSelect();
    },

    renderKeyFileSelect: function() {
        var keyFileName = this.model.get('keyFileName'),
            oldKeyFileName = this.model.get('oldKeyFileName'),
            keyFileChanged = this.model.get('keyFileChanged');
        var sel = this.$el.find('#settings__file-key-file');
        sel.html('');
        if (keyFileName && keyFileChanged) {
            var text = keyFileName !== 'Generated' ? 'Use key file ' + keyFileName : 'Use generated key file';
            $('<option/>').val('ex').text(text).appendTo(sel);
        }
        if (oldKeyFileName) {
            $('<option/>').val('old').text('Use ' + (keyFileChanged ? 'old ' : '') + 'key file ' + oldKeyFileName).appendTo(sel);
        }
        $('<option/>').val('gen').text('Generate new key file').appendTo(sel);
        $('<option/>').val('none').text('Don\'t use key file').appendTo(sel);
        if (keyFileName && keyFileChanged) {
            sel.val('ex');
        } else if (!keyFileName) {
            sel.val('none');
        } else if (oldKeyFileName && keyFileName === oldKeyFileName && !keyFileChanged) {
            sel.val('old');
        }
    },

    validate: function() {
        if (!this.model.get('passwordLength')) {
            Alerts.error({
                header: 'Empty password',
                body: 'Please, enter the password. You will use it the next time you open this file.',
                complete: (function() {
                    this.$el.find('#settings__file-master-pass').focus();
                }).bind(this)
            });
            return false;
        }
        return true;
    },

    saveToFile: function() {
        if (!this.validate()) {
            return;
        }
        var data = this.model.getData();
        var blob = new Blob([data], {type: 'application/octet-stream'});
        FileSaver.saveAs(blob, this.model.get('name') + '.kdbx');
    },

    exportAsXml: function() {
        if (!this.validate()) {
            return;
        }
        var data = this.model.getXml();
        var blob = new Blob([data], {type: 'text/xml'});
        FileSaver.saveAs(blob, this.model.get('name') + '.xml');
    },

    saveToDropbox: function() {
        if (!this.validate()) {
            return;
        }
        Alerts.notImplemented();
    },

    keyFileChange: function(e) {
        switch (e.target.value) {
            case 'old':
                this.selectOldKeyFile();
                break;
            case 'gen':
                this.generateKeyFile();
                break;
            case 'none':
                this.clearKeyFile();
                break;
        }
    },

    selectOldKeyFile: function() {
        this.model.resetKeyFile();
        this.renderKeyFileSelect();
    },

    generateKeyFile: function() {
        var keyFile = this.model.generateAndSetKeyFile();
        var blob = new Blob([keyFile], {type: 'application/octet-stream'});
        FileSaver.saveAs(blob, this.model.get('name') + '.key');
        this.renderKeyFileSelect();
    },

    clearKeyFile: function() {
        this.model.removeKeyFile();
        this.renderKeyFileSelect();
    },

    triggerSelectFile: function() {
        this.$el.find('#settings__file-file-select').click();
    },

    fileSelected: function(e) {
        var file = e.target.files[0];
        var reader = new FileReader();
        reader.onload = (function(e) {
            var res = e.target.result;
            this.model.setKeyFile(res, file.name);
            this.renderKeyFileSelect();
        }).bind(this);
        reader.readAsArrayBuffer(file);
    },

    focusMasterPass: function(e) {
        if (!this.passwordChanged) {
            e.target.value = '';
        }
        e.target.setAttribute('type', 'text');
    },

    blurMasterPass: function(e) {
        if (!e.target.value) {
            this.passwordChanged = false;
            this.model.resetPassword();
            e.target.value = PasswordDisplay.present(this.model.get('passwordLength'));
            this.$el.find('.settings__file-master-pass-warning').hide();
        } else {
            this.passwordChanged = true;
            this.model.setPassword(kdbxweb.ProtectedValue.fromString(e.target.value));
            if (!this.model.get('created')) {
                this.$el.find('.settings__file-master-pass-warning').show();
            }
        }
        e.target.setAttribute('type', 'password');
    },

    blurName: function(e) {
        var value = $.trim(e.target.value);
        if (!value) {
            e.target.value = this.model.get('name');
            return;
        }
        this.model.setName(value);
    },

    blurDefUser: function(e) {
        var value = $.trim(e.target.value);
        this.model.setDefaultUser(value);
    },

    changeTrash: function(e) {
        this.model.setRecycleBinEnabled(e.target.checked);
    },

    blurHistoryLength: function(e) {
        var value = +e.target.value;
        if (isNaN(value)) {
            e.target.value = this.model.get('historyMaxItems');
            return;
        }
        this.model.setHistoryMaxItems(value);
    },

    blurHistorySize: function(e) {
        var value = +e.target.value;
        if (isNaN(value)) {
            e.target.value = this.model.get('historyMaxSize') / 1024 / 1024;
            return;
        }
        this.model.setHistoryMaxSize(value * 1024 * 1024);
    },

    blurKeyRounds: function(e) {
        var value = +e.target.value;
        if (isNaN(value)) {
            e.target.value = this.model.get('keyEncryptionRounds');
            return;
        }
        this.model.setKeyEncryptionRounds(value);
    }
});

module.exports = SettingsAboutView;