/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is
 * Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var SC = require("sproutcore/runtime").SC;
var catalog = require("bespin:plugins").catalog;

var Promise = require("Promise:core/promise").Promise;
var groupPromises = require("Promise:core/promise").group;

var types = require("Types:types");

/**
 * Find and configure the settings object.
 * @see MemorySettings.addSetting()
 */
exports.addSetting = function(settingExt) {
    catalog.getObject("settings").addSetting(settingExt);
};

/**
 *
 */
exports.getSettingNames = function() {
    return catalog.getObject("settings")._getSettingNames();
};

/**
 * A base class for all the various methods of storing settings.
 * <p>Usage:
 * <pre>
 * // Create manually, or require 'settings' from the container.
 * // This is the manual version:
 * var settings = require("bespin:plugins").catalog.getObject("settings");
 * // Add a new setting
 * settings.addSetting({ name:"foo", ... });
 * // Display the default value
 * alert(settings.get("foo"));
 * // Alter the value, which also publishes the change etc.
 * settings.set("foo", "bar");
 * // Reset the value to the default
 * settings.resetValue("foo");
 * </pre>
 * <p>Subclasses should override _changeValue() and _loadInitialValues().
 * @class
 */
exports.MemorySettings = SC.Object.extend({
    /**
     * Setup the default settings
     * @constructs
     */
    init: function() {
        // We delay this because publishing to a bunch of things can cause lots
        // of objects to be created, and it's a bad idea to do that while a core
        // component (i.e. settings) is being created.
        setTimeout(function() {
            this._loadInitialValues();
        }.bind(this), 10);
    },

    /**
     * Function to add to the list of available choices.
     * <p>Example usage:
     * <pre>
     * var settings = require("bespin:plugins").catalog.getObject("settings");
     * settings.addSetting({
     *     name: "tabsize", // For use in settings.get("X")
     *     type: "number",  // To allow value checking.
     *     defaultValue: 4  // Default value for use when none is directly set
     * });
     * </pre>
     * @param {object} choice Object containing name/type/defaultValue members.
     */
    addSetting: function(settingExt) {
        if (!settingExt.name) {
            throw "Settings need 'name' members";
        }

        types.getTypeExt(settingExt.type).then(function(typeExt) {
            if (!typeExt) {
                throw "choice.type should be one of " +
                        "[" + this._getSettingNames().join("|") + "]. " +
                        "Got " + settingExt.type;
            }

            if (!settingExt.defaultValue === undefined) {
                throw "Settings need 'defaultValue' members";
            }

            // Load the type so we can check the validator
            typeExt.load(function(type) {
                if (!type.isValid(settingExt.defaultValue)) {
                    throw "Default value " + settingExt.defaultValue +
                            " is not a valid " + settingExt.type;
                }

                // Set the default value up.
                this.set(settingExt.name, settingExt.defaultValue);

                // Add a setter to this so subclasses can save
                this.addObserver(settingExt.name, this, function() {
                    this._changeValue(settingExt.name, this.get(settingExt.name));
                }.bind(this));
            }.bind(this));
        }.bind(this));
    },

    /**
     * Reset the value of the <code>key</code> setting to it's default
     */
    resetValue: function(key) {
        var setting = choice._settings[key];
        if (setting) {
            this.set(key, setting.defaultValue);
        } else {
            delete this.ignored[key];
        }
    },

    /**
     * Make a list of the valid type names
     */
    _getSettingNames: function() {
        var typeNames = [];
        catalog.getExtensions("setting").forEach(function(settingExt) {
            typeNames.push(settingExt.name);
        });
        return typeNames;
    },

    /**
     * Retrieve a list of the known settings and their values
     */
    _list: function() {
        var reply = [];
        this._getSettingNames().forEach(function(key) {
            reply.push({
                'key': prop,
                'value': this.get(prop)
            });
        }.bind(this));
        return reply;
    },

    /**
     * Subclasses should overload this.
     * Called whenever a value changes, which allows persistent subclasses to
     * take action to persist the new value
     */
    _changeValue: function(key, value) {
    },

    /**
     * Subclasses should overload this, probably calling _loadDefaultValues()
     * as part of the process before user values are included.
     */
    _loadInitialValues: function() {
        return this._loadDefaultValues();
    },

    /**
     * Prime the local cache with the defaults.
     */
    _loadDefaultValues: function() {
        return this._loadFromObject(this._defaultValues());
    },

    /**
     * Utility to load settings from an object
     */
    _loadFromObject: function(data) {
        var promises = [];
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var value = data[key];
                var settingExt = catalog.getExtensionByKey("type", key);
                if (settingExt) {
                    // TODO: We shouldn't just ignore values without a setting
                    var promise = types.fromString(value, settingExt.type);
                    promise.then(function(value) {
                        this.set(key, value);
                    });
                    promises.push(promise);
                }
            }
        }

        // Promise.group (a.k.a groupPromises) gives you a list of all the data
        // in the grouped promises. We don't want that in case we change how
        // this works with ignored settings (see above).
        // So we do this to hide the list of promise resolutions.
        var replyPromise = new Promise();
        groupPromises(promises).then(function() {
            replyPromise.resolve();
        });
        return replyPromise;
    },

    /**
     * Utility to grab all the settings and export them into an object
     */
    _saveToObject: function() {
        var promises = [];
        var reply = {};

        this._getSettingNames().forEach(function(key) {
            var value = this.get(key);
            var settingExt = catalog.getExtensionByKey("type", key);
            if (settingExt) {
                // TODO: We shouldn't just ignore values without a setting
                var promise = types.toString(value, settingExt.type);
                promise.then(function(value) {
                    reply[key] = value;
                });
                promises.push(promise);
            }
        }.bind(this));

        var replyPromise = new Promise();
        groupPromises(promises).then(function() {
            replyPromise.resolve(reply);
        });
        return replyPromise;
    },

    /**
     * The default initial settings
     */
    _defaultValues: function() {
        var defaultValues = {};
        catalog.getExtensions("setting").forEach(function(settingExt) {
            defaultValues[settingExt.name] = settingExt.defaultValue;
        });
        return defaultValues;
    }
});
