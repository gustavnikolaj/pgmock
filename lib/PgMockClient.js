var _ = require('lodash');
var expect = require('unexpected')
    .clone()
    .addAssertion('to have expected query count', function (expect, subject) {
        this.errorMode = 'bubble';
        var expectedCalls = subject.expectedCalls.length;
        var calls = typeof subject.callIndex === 'number' ? subject.callIndex + 1 : 0;
        try {
            expect(expectedCalls, 'to equal', calls);
        } catch (e) {
            expect.fail(function (output) {
                output.error('expected pg to be queried').sp()
                    .text(expectedCalls).sp()
                    .error((expectedCalls === 1 ? 'time' : 'times')).sp()
                    .error('but it was queried').sp()
                    .text(calls).sp()
                    .error((calls === 1 ? 'time' : 'times'))
                    .error('.');
            });
        }
    })
    .addAssertion('[not] to be removed from connection pool', function (expect, subject) {
        this.errorMode = 'bubble';
        try {
            expect(subject.removedFromPool, '[not] to be true');
        } catch (e) {
            var testDescription = this.testDescription;
            expect.fail(function (output) {
                output.error('expected client').sp().error(testDescription).error('.');
            });
        }
    })
    .addAssertion('[not] to be returned to connection pool', function (expect, subject) {
        this.errorMode = 'bubble';
        try {
            expect(subject.returnedToPool, '[not] to be true');
        } catch (e) {
            var testDescription = this.testDescription;
            expect.fail(function (output) {
                output.error('expected client').sp().error(testDescription).error('.');
            });
        }
    });

function PgMockClient(expectedCalls) {
    this.expectedCalls = expectedCalls;
    this.callIndex = null;

    this.errored = false;
    this.removedFromPool = false;
    this.returnedToPool = false;
}

PgMockClient.prototype.query = function (query, params, callback) {
    if (this.removedFromPool || this.returnedToPool) {
        expect.fail('Calling query on client after calling done.');
    }

    this.callIndex = typeof this.callIndex === 'number' ? this.callIndex + 1 : 0;

    if (typeof this.expectedCalls[this.callIndex] === 'undefined') {
        expect(this, 'to have expected query count');
    }

    var data = _.cloneDeep(this.expectedCalls[this.callIndex]);

    if (data.result instanceof Error) {
        this.errored = true;
        setImmediate(function () {
            callback(data.result);
        });
    } else {
        expect(query, 'to equal', data.query);

        expect(params, 'to satisfy', data.params || []);

        if (!data.result.rows) {
            data.result.rows = [];
        }
        expect(data.result, 'to satisfy', {
            rows: expect.it('to be an array')
        });

        if (!data.result.rowCount) {
            data.result.rowCount = data.result.rows.length;
        }

        setImmediate(function () {
            callback(null, data.result);
        });
    }
};

PgMockClient.prototype.assert = function () {
    expect(this, 'to have expected query count');
    if (this.errored) {
        expect(this, 'not to be returned to connection pool');
        expect(this, 'to be removed from connection pool');
    } else {
        expect(this, 'not to be removed from connection pool');
        expect(this, 'to be returned to connection pool');
    }
};

module.exports = PgMockClient;
