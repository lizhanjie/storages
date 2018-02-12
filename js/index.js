/*
 * Storage - 1.0.0
 *
 * options [选填] js对象。
 * {
 ***   exp:   100,类型Number。超时时间，秒。默认无限大。
 ***   force: true,可删除
 ***   sign : 前缀Storage_,标示可自定义，
 ***   value: [必填] 支持所有可以JSON.parse 的类型。注：当为undefined的时候会执行 delete(key)操作。
 * }
 */
"use strict";
const _gol = window || this;

const [_storage, _doc] = [_gol.localStorage, _gol.document];
const _maxExpireDate = new Date('Fri, 31 Dec 9999 23:59:59 UTC');

let _defaultExpire = _maxExpireDate;
const _defaultSerializer = {
    serialize: (item) => JSON.stringify(item),
    deserialize: (data) => data && JSON.parse(data),
    deepParse: function(obj) {
        obj = this.deserialize(obj);
        if (typeof obj == 'object' && obj.map) return obj.map((v, k) => {
            return this.deserialize(v);
        });
        return [].concat(this.deserialize(obj));
    }
};

const _extend = (obj, props) => {
    for (let key in props) obj[key] = props[key];
    return obj;
};

const _isValidDate = (date) => Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime());

const _getExpiresDate = (expires, now) => {
    now = now || new Date();
    if (typeof expires === 'number') {
        expires = expires === Infinity ?
            _maxExpireDate : new Date(now.getTime() + expires * 1000);
    } else if (typeof expires === 'string') {
        expires = new Date(expires);
    }
    if (expires && !_isValidDate(expires)) {
        throw new Error('`expires` parameter cannot be converted to a valid Date instance');
    }

    return expires;
};

const _removeItem = (item, key, val, ikey) => {
    let newItem = [].concat(item);
    let dx = _checkIndexOf(newItem, key, ikey)

    if (dx > -1) {
        if (val) newItem.splice(dx, 1).splice(dx, 0, val);
        else newItem.splice(dx, 1);
        return newItem;
    } else return newItem;
};

const _isQuotaExceeded = (e) => { //超过大小
    let quotaExceeded = false;
    if (e) {
        if (e.code) {
            switch (e.code) {
                case 22:
                    quotaExceeded = true;
                    break;
                case 1014:
                    if (e.name === 'NS_ERROR_DOM_QUOTA_REACHED') quotaExceeded = true;
                    break;
            }
        } else if (e.number === -2147024882) {
            quotaExceeded = true;
        }
    }
    return quotaExceeded;
};
const _isCacheItem = (item) => {
    if (typeof item !== 'object') return false;
    if (item)
        if ('c' in item && 'e' in item && 'v' in item) return true;
    return false;
};

const _checkCacheItemIfEffective = (cacheItem) => (new Date()).getTime() < cacheItem.e;

const _checkAndWrapKeyAsString = (key) => {
    if (typeof key !== 'string') {
        console.warn('key used as a key, but get `${key}`');
        key = String(key);
    }
    return key;
};

const _checkIndexOf = (checks, val, key) => {
    let result = false;

    let arr = [].concat(checks);

    for (let i = 0, len = arr.length; i < len; i++) {
        if (key) {
            if (JSON.parse(arr[i])[key] == JSON.parse(val)[key]) {
                result = i;
                break;
            } else result = -1;
        } else {
            if (arr[i] == val) {
                result = i;
                break;
            } else result = -1;
        }
    }
    return result;
};

const _checkCacheName = (name, sign) => name.indexOf(sign) > -1;
const _getRealName = (key, sign) => _checkCacheName(key, sign) ? key : sign + key;


class CacheItemConstructor {
    constructor(value, ops) {
        let exp = ops.exp || _defaultExpire;
        let expires = _getExpiresDate(exp);
        this.c = (new Date()).getTime();
        this.e = expires.getTime();
        this.v = value;
        this.p = ops.path || '/';
        this.d = ops.domain;
    }
};

class Storage {
    constructor(options) {
        this.isSupported = _storage;
        this._init(options);
    }

    _init(options) {
        let defaults = {
            storage: 'localStorage',
            exp: Infinity,
            sign: 'Storage_'
        };

        let opt = _extend(defaults, options);

        let expires = opt.exp;

        if (expires && typeof expires !== 'number' && !_isValidDate(expires))
            throw new Error('exp used a Date or number or noop but get `${expires}`');
        else _defaultExpire = expires;

        this._sign = opt.sign;

        if (this.isSupported) this._checkList(_storage);

        if (!this.isSupported && !_doc['cookie']) {
            _extend(this, this._cacheApi());
            console.error('need open locationStorage or cookie, please check your browser');
        }

    }

    _checkList(item) {
        if (typeof item !== 'object') return false;
        for (let name in item) {
            if (_checkCacheName(name, this._sign)) {
                let cacheItem = _checkCacheItemIfEffective(_defaultSerializer.deserialize(item[name]));
                if (!cacheItem) this.delete(name);
            }
        }
    }

    _quotaExceedHandler(key, val, options, e) {
        if (options && options.force === true) {
            let deleteKeys = this.deleteAll();
            console.warn('delete all expires CacheItem : [`${deleteKeys}`] and try execute `set` method again!');
            try {
                options.force = false;
                this.set(key, val, options);
            } catch (err) {
                console.warn('set localstorage failed, error is : %s', err);
            }
        }
    }

    _cacheApi() {
        return {
            set: function(key, value, options) {},
            get: function(key, deep) {},
            delete: function(key) {},
            deleteAll: function() {},
            add: function(key, options) {},
            replace: function(key, value, options) {},
            clear: function() {}
        };
    }

    _setCookie(key, val, item) {
        let cookieStr = '',
            nDays = new Date();
        cookieStr += key + '=' + encodeURIComponent(val);
        if (typeof item == 'object') {
            item.e && (nDays.setTime(item.e || (nDays.getTime() + Number(item.exp) * 1000)), cookieStr += '; expires=' + nDays.toGMTString());
            item.p && (cookieStr += '; path=' + item.p);
            item.d && (cookieStr += '; domain=' + item.d);
        }
        _doc.cookie = cookieStr;
        return cookieStr;
    }

    _getCookie(key) {
        var arr = [],
            reg = new RegExp("(^| )" + key + "=([^;]*)(;|$)");
        arr = _doc['cookie'].match(reg);
        return arr ? decodeURIComponent(arr[2]) : null;
    }

    _delCookie(key, item) {
        debugger;
        if (typeof item == 'object') this._setCookie(key, '', item);
        else this._setCookie(key, '', -1, {
            e: '-1'
        });
        return key;
    }

    set(key = _checkAndWrapKeyAsString(key), val, options = {}) {

        options = _extend({
            force: true
        }, options);
        key = _getRealName(key, this._sign);
        if (val === undefined) return this.delete(key);
        let value = _defaultSerializer.serialize(val);
        let cacheItem = new CacheItemConstructor(value, options);
        if (this.isSupported) {
            try {
                _storage.setItem(key, _defaultSerializer.serialize(cacheItem));
            } catch (e) {
                if (_isQuotaExceeded(e)) this._quotaExceedHandler(key, value, options, e);
            }
        } else this._setCookie(key, val, cacheItem);
        return this;
    }

    get(key = _checkAndWrapKeyAsString(key), deep = false) {

        let cacheItem = null;
        key = _getRealName(key, this._sign);
        if (this.isSupported) {
            try {
                cacheItem = _defaultSerializer.deserialize(_storage.getItem(key));
                if (_isCacheItem(cacheItem)) {
                    if (_checkCacheItemIfEffective(cacheItem)) {
                        let value = cacheItem.v;
                        return deep ? _defaultSerializer.deepParse(value) : _defaultSerializer.deserialize(value);
                    } else this.delete(key);
                } else return null;
            } catch (e) {
                return null;
            }
        } else return this._getCookie(key);
    }

    delete(key = _checkAndWrapKeyAsString(key)) {
        key = _getRealName(key, this._sign);
        if (this.isSupported) _storage.removeItem(key);
        else this._delCookie(key);
        return this;
    }

    deleteAll() {
        let length = _storage.length;
        let deleteKeys = [];
        let _this = this;
        for (let i = 0; i < length; i++) {
            let key = _storage.key(i);
            let cacheItem = null;
            try {
                cacheItem = _defaultSerializer.deserialize(_storage.getItem(key));
            } catch (e) {}

            if (cacheItem !== null && cacheItem.e !== undefined) {
                let timeNow = (new Date()).getTime();
                if (timeNow >= cacheItem.e) {
                    deleteKeys.push(key);
                }
            }
        }
        deleteKeys.forEach(function(key) {
            _this.delete(key);
        });
        return deleteKeys;
    }

    add(key = _checkAndWrapKeyAsString(key), value, options) {
        key = _getRealName(key, this._sign);
        options = _extend({
            force: true
        }, options);
        if (this.isSupported) {

            try {
                let cacheItem = _defaultSerializer.deserialize(_storage.getItem(key));
                if (!_isCacheItem(cacheItem) || !_checkCacheItemIfEffective(cacheItem)) {
                    this.set(key, value, options);
                    return value;
                } else {
                    let oldValue = this.get(key);
                    let index = _checkIndexOf(oldValue, value, options.key);

                    if (index == -1) {
                        let newValue = [].concat(value).concat(oldValue);
                        this.set(key, newValue, options);
                        return newValue;
                    } else {
                        let newValues = [].concat(value);
                        let resultValue;
                        oldValue.splice(index, 1);
                        resultValue = newValues.concat(oldValue);
                        this.set(key, resultValue, options);
                        return resultValue;
                    }
                    return oldValue;
                }
            } catch (e) {
                this.set(key, value, options);
                return value;
            }
        } else {
            let old = this._getCookie(key);
            if (old.indexOf(value) == -1) {
                let newValue = [].concat(value).concat(old);
                this.set(key, newValue, options);
                return newValue;
            }
            return old;
        }
        return null;
    }

    replace(key = _checkAndWrapKeyAsString(key), ikey = '', value = '', options = {}) {
        key = _getRealName(key, this._sign);
        let item = this.get(key);
        let newItem = _removeItem(item, ikey, value, options.key);

        this.set(key, newItem, options);
        return this;
    }

    search(key = _checkAndWrapKeyAsString(key), ikey) {
        key = _getRealName(key, this._sign), result = [];
        let list = this.get(key);
        list.forEach(function(v, i) {
            if (v.indexOf(ikey) > -1) result.push(v);
        })
        return result;
    }

    clear() {
        _storage.clear();
        return _storage;
    }

};

if (typeof define === 'function' && define.amd) define(function() {
    return Storage
});
else if (typeof exports === 'object') module.exports = Storage;
else _gol.Storage = Storage;