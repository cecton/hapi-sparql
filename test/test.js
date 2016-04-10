import {expect} from 'chai'
import Hapi from 'hapi'
import {register} from '../src/index'
import parallel from 'mocha.parallel'

/*
 * NOTE: you should use parallel here and not describe, otherwise the
 * injections will not work properly.
 *
 * See https://github.com/hapijs/hapi/issues/1299
 *
 */

parallel('hapi-sparql', () => {
  const request = (method, url, headers, content, callback) => {
    callback(null, {
      headers: {
        'content-type': 'application/json'
      },
      body: {method, url, headers, content},
      statusCode: 202
    })
  }

  const endpointUrl = 'http://example.org/sparql'
  const constructQuery = 'CONSTRUCT {?s ?p ?o} WHERE {?s ?p ?o}'
  const selectQuery = 'SELECT * WHERE {?s ?p ?o}'
  const updateQuery = 'INSERT {<http://example.org/subject> <http://example.org/predicate> "object"} WHERE {}'

  it('should reject invalid options', (done) => {
    const server = new Hapi.Server()
    server.register({
      register,
      options: {}
    }, (err) => {
      expect(err).to.be.ok
      done()
    })
  })

  it('should use endpointUrl as fallback value for updateUrl', (done) => {
    const server = new Hapi.Server()
    server.connection()
    server.register({
      register,
      options: {request, endpointUrl}
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          sparql: {
            type: 'update',
            query: updateQuery
          }
        }
      })
      server.inject('/', (res) => {
        expect(res.result.url).to.be.equal('http://example.org/sparql')
        done()
      })
    })
  })

  it('can have a different updateUrl', (done) => {
    const server = new Hapi.Server()
    server.connection()
    server.register({
      register,
      options: {
        request,
        endpointUrl,
        updateUrl: 'http://another.org/sparql'
      }
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          sparql: {
            type: 'update',
            query: updateQuery
          }
        }
      })
      server.inject('/', (res) => {
        expect(res.result.url).to.be.equal('http://another.org/sparql')
        done()
      })
    })
  })

  it('bind query params to the query', (done) => {
    const server = new Hapi.Server()
    server.connection()
    server.register({
      register,
      options: {request, endpointUrl}
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          sparql: {
            type: 'select',
            query: selectQuery,
            placeholders: ['s', 'o']
          }
        }
      })
      server.inject({
        method: 'GET',
        url: '/?s=foo&p=bar&o=baz'
      }, (res) => {
        expect(res.result.url).to.be.equal(
          'http://example.org/sparql?query=' +
          encodeURIComponent('SELECT * WHERE {foo ?p baz}'))
        done()
      })
    })
  })

  it('can make SELECT query', (done) => {
    const server = new Hapi.Server()
    server.connection()
    server.register({
      register,
      options: {request, endpointUrl}
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          sparql: {
            type: 'select',
            query: selectQuery
          }
        }
      })
      server.inject('/', (res) => {
        expect(res.statusCode).to.be.equal(202)
        expect(res.headers['content-type']).to.match(/application\/json/)
        expect(res.result.method).to.be.equal('GET')
        expect(res.result.url).to.be.equal(
          'http://example.org/sparql?query=' + encodeURIComponent(selectQuery))
        done()
      })
    })
  })

  it('can make CONSTRUCT query', (done) => {
    const server = new Hapi.Server()
    server.connection()
    server.register({
      register,
      options: {request, endpointUrl}
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          sparql: {
            type: 'construct',
            query: constructQuery
          }
        }
      })
      server.inject('/', (res) => {
        expect(res.statusCode).to.be.equal(202)
        expect(res.headers['content-type']).to.match(/application\/json/)
        expect(res.result.method).to.be.equal('GET')
        expect(res.result.url).to.be.equal(
          'http://example.org/sparql?query=' +
          encodeURIComponent(constructQuery))
        done()
      })
    })
  })

  it('can make UPDATE query', (done) => {
    const server = new Hapi.Server()
    server.connection()
    server.register({
      register,
      options: {request, endpointUrl}
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          sparql: {
            type: 'update',
            query: updateQuery
          }
        }
      })
      server.inject('/', (res) => {
        expect(res.statusCode).to.be.equal(202)
        expect(res.headers['content-type']).to.match(/application\/json/)
        expect(res.result.method).to.be.equal('POST')
        expect(res.result.url).to.be.equal('http://example.org/sparql')
        expect(res.result.content).to.be.equal(
          'query=' + encodeURIComponent(updateQuery))
        done()
      })
    })
  })

  it('forwards failed response of failed request', (done) => {
    const failingRequest = (method, url, headers, content, callback) => {
      callback(null, {
        headers: {
          'content-type': 'text/plain'
        },
        body: 'invalid query',
        statusCode: 406
      })
    }
    const server = new Hapi.Server()
    server.connection()
    server.register({
      register,
      options: {
        request: failingRequest,
        endpointUrl
      }
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          sparql: {
            type: 'select',
            query: selectQuery
          }
        }
      })
      server.inject('/', (res) => {
        expect(res.result.statusCode).to.be.equal(406)
        expect(res.headers['content-type']).to.match(/application\/json/)
        expect(res.result.message).to.be.equal('invalid query')
        done()
      })
    })
  })
})
