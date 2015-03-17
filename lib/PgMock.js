var PgMockClient = require('./PgMockClient');

function PgMock(options) {
    this.errorOnConnect = options instanceof Error ? options : false;
    this.expectedCalls = Array.isArray(options) ? [].concat(options) : [];
    this.client = new PgMockClient(this.expectedCalls);
    this.connectCalled = false;
}

PgMock.prototype.clientDoneCallback = function (client) {
    if (client) {
        this.client.removedFromPool = true;
    } else {
        this.client.returnedToPool = true;
    }
};

PgMock.prototype.connect = function (dbUrl, callback) {
    var that = this;
    this.connectCalled = true;
    if (this.errorOnConnect) {
        this.client.errored = true;
        setImmediate(function () {
            callback(that.errorOnConnect, that.client, that.clientDoneCallback.bind(that));
        });
    } else {
        setImmediate(function () {
            callback(null, that.client, that.clientDoneCallback.bind(that));
        });
    }
};

PgMock.prototype.assert = function () {
    if (this.connectCalled) {
        this.client.assert();
    }
};

module.exports = PgMock;
