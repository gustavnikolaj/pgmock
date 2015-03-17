/* global describe, it */
var expect = require('unexpected');
var PgMock = require('../lib/PgMock');

describe('PgMock', function () {
    it('should emit error on connect', function (done) {
        var error = new Error('Error on connect');
        var pgMock = new PgMock(error);

        pgMock.connect('foo', function (err, client, pgDone) {
            expect(err, 'to be', error);
            done();
        });
    });
    it('should fail if not called when expecting a single call', function (done) {
        var pgMock = new PgMock([
            {
                query: 'SELECT * FROM pets',
                result: {
                    rows: [
                        {
                            id: '1',
                            name: 'Fido'
                        }
                    ]
                }
            }
        ]);
        pgMock.connect('foo', function (err, client, pgDone) {
            expect(function () {
                pgMock.assert();
            }, 'to throw', 'expected pg to be queried 1 time but it was queried 0 times.');
            done();
        });
    });
    it('should fail called not expecting any calls', function (done) {
        var pgMock = new PgMock([]);
        pgMock.connect('foo', function (err, client, pgDone) {
            expect(function () {
                client.query();
            }, 'to throw', 'expected pg to be queried 0 times but it was queried 1 time.');
            done();
        });
    });
    it('should give the expected result to the callback if the query was as expected', function (done) {
        var pgMock = new PgMock([
            {
                query: 'SELECT * FROM pets',
                result: {
                    rows: [
                        {
                            id: '1',
                            name: 'Fido'
                        }
                    ]
                }
            }
        ]);
        pgMock.connect('foo', function (err, client, pgDone) {
            client.query('SELECT * FROM pets', [], function (err, result) {
                expect(err, 'to be null');
                expect(result, 'to satisfy', {
                    rows: [
                        {
                            id: '1',
                            name: 'Fido'
                        }
                    ]
                });
                pgDone();
                expect(function () {
                    pgMock.assert();
                }, 'not to throw');
                done();
            });
        });
    });
    it('should allow to satisfy semantics in params', function (done) {
        var pgMock = new PgMock([
            {
                query: 'SELECT * FROM pets WHERE name = $1',
                params: [ /^Fi/ ],
                result: {
                    rows: [
                        {
                            id: '1',
                            name: 'Fido'
                        }
                    ]
                }
            }
        ]);
        pgMock.connect('foo', function (err, client, pgDone) {
            client.query('SELECT * FROM pets WHERE name = $1', [ 'Fido' ], function (err, result) {
                expect(err, 'to be null');
                expect(result, 'to satisfy', {
                    rows: [
                        {
                            id: '1',
                            name: 'Fido'
                        }
                    ]
                });
                pgDone();
                expect(function () {
                    pgMock.assert();
                }, 'not to throw');
                done();
            });
        });
    });
    it('should fail if you try to call query on the client, after it has been returned to the pool.', function (done) {
        var pgMock = new PgMock([
            {
                query: 'SELECT * FROM pets WHERE name = $1',
                params: [ /^Fi/ ],
                result: {
                    rows: [
                        {
                            id: '1',
                            name: 'Fido'
                        }
                    ]
                }
            }
        ]);
        pgMock.connect('foo', function (err, client, pgDone) {
            pgDone();
            expect(function () {
                client.query('SELECT * FROM pets WHERE name = $1', [ 'Fido' ]);
            }, 'to throw', 'Calling query on client after calling done.');
            done();
        });
    });
    describe('connection pool', function () {
        describe('returning', function () {
            it('should complain if the client is not returned to the connection pool', function (done) {
                var pgMock = new PgMock([
                    {
                        query: 'SELECT * FROM pets',
                        result: {}
                    }
                ]);
                pgMock.connect('foo', function (err, client, pgDone) {
                    client.query('SELECT * FROM pets', [], function (err, result) {
                        expect(function () {
                            pgMock.assert();
                        }, 'to throw', 'expected client to be returned to connection pool.');
                        done();
                    });
                });
            });
            it('should not complain if the client is returned to the connection pool', function (done) {
                var pgMock = new PgMock([
                    {
                        query: 'SELECT * FROM pets',
                        result: {}
                    }
                ]);
                pgMock.connect('foo', function (err, client, pgDone) {
                    client.query('SELECT * FROM pets', [], function (err, result) {
                        pgDone();
                        expect(function () {
                            pgMock.assert();
                        }, 'not to throw');
                        done();
                    });
                });
            });
            it('should complain if the client is not returned to the connection pool even with no queries executed', function (done) {
                var pgMock = new PgMock([]);
                pgMock.connect('foo', function (err, client, pgDone) {
                    expect(function () {
                        pgMock.assert();
                    }, 'to throw', 'expected client to be returned to connection pool.');
                    done();
                });
            });
            it('should not complain if the client is returned to the connection pool even with no queries executed', function (done) {
                var pgMock = new PgMock([]);
                pgMock.connect('foo', function (err, client, pgDone) {
                    pgDone();
                    expect(function () {
                        pgMock.assert();
                    }, 'not to throw');
                    done();
                });
            });
            it('should complain if the client is returned to the pool after an error', function (done) {
                var error = new Error('Error on connect');
                var pgMock = new PgMock(error);
                pgMock.connect('foo', function (err, client, pgDone) {
                    pgDone();
                    expect(function () {
                        pgMock.assert();
                    }, 'to throw', 'expected client not to be returned to connection pool.');
                    done();
                });
            });
        });
        describe('removing', function () {
            it('should complain if the client is not removed from the connection pool when a query errored', function (done) {
                var pgMock = new PgMock([
                    {
                        query: 'SELECT * FROM pets',
                        result: new Error('Mock error')
                    }
                ]);
                pgMock.connect('foo', function (err, client, pgDone) {
                    client.query('SELECT * FROM pets', [], function (err, result) {
                        expect(function () {
                            pgMock.assert();
                        }, 'to throw', 'expected client to be removed from connection pool.');
                        done();
                    });
                });
            });
            it('should not complain if the client is removed from the connection pool when a query errored', function (done) {
                var pgMock = new PgMock([
                    {
                        query: 'SELECT * FROM pets',
                        result: new Error('Mock error')
                    }
                ]);
                pgMock.connect('foo', function (err, client, pgDone) {
                    client.query('SELECT * FROM pets', [], function (err, result) {
                        pgDone(client);
                        expect(function () {
                            pgMock.assert();
                        }, 'not to throw');
                        done();
                    });
                });
            });
            it('should complain if the client is not removed from the connection pool when connection failed', function (done) {
                var error = new Error('Error on connect');
                var pgMock = new PgMock(error);

                pgMock.connect('foo', function (err, client, pgDone) {
                    expect(function () {
                        pgMock.assert();
                    }, 'to throw', 'expected client to be removed from connection pool.');
                    done();
                });
            });
            it('should not complain if the client is removed from the connection pool when connection failed', function (done) {
                var error = new Error('Error on connect');
                var pgMock = new PgMock(error);

                pgMock.connect('foo', function (err, client, pgDone) {
                    pgDone(client);
                    expect(function () {
                        pgMock.assert();
                    }, 'not to throw');
                    done();
                });
            });
            it('should complain if the client is removed from the pool with no error', function (done) {
                var pgMock = new PgMock([]);
                pgMock.connect('foo', function (err, client, pgDone) {
                    pgDone(client);
                    expect(function () {
                        pgMock.assert();
                    }, 'to throw', 'expected client not to be removed from connection pool.');
                    done();
                });
            });
        });
    });
});
