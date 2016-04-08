import {expect} from 'chai'
import Hapi from 'hapi'
import {SparqlClient, register} from '../src/index'
import parallel from 'mocha.parallel'
import SparqlHttp from 'sparql-http-client'

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
          'content-type': 'application/json',
        },
        body: {
          status: 'ok',
          method: method,
          url: url,
          headers: headers,
          content: content
        }
      })
    }

  const constructQuery = 'CONSTRUCT {?s ?p ?o} WHERE {?s ?p ?o}'
  const selectQuery = 'SELECT * WHERE {?s ?p ?o}'
  const updateQuery = 'INSERT {<http://example.org/subject> <http://example.org/predicate> "object"} WHERE {}'

  it('should reject invalid options', (done) => {
    const server = new Hapi.Server()
    server.register({
      register: register,
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
      register: register,
      options: {
        request: request,
        endpointUrl: 'http://example.org/sparql'
      }
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          'sparql': {
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
      register: register,
      options: {
        request: request,
        endpointUrl: 'http://example.org/sparql',
        updateUrl: 'http://another.org/sparql'
      }
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          'sparql': {
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
      register: register,
      options: {
        request: request,
        endpointUrl: 'http://example.org/sparql',
      }
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          'sparql': {
            type: 'select',
            query: selectQuery,
            placeholders: ['s', 'o']
          }
        }
      })
      server.inject({
        method: 'GET',
        url: '/?s=foo&p=bar&o=baz',
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
      register: register,
      options: {
        request: request,
        endpointUrl: 'http://example.org/sparql',
        updateUrl: 'http://another.org/sparql'
      }
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          'sparql': {
            type: 'select',
            query: selectQuery
          }
        }
      })
      server.inject('/', (res) => {
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
      register: register,
      options: {
        request: request,
        endpointUrl: 'http://example.org/sparql',
        updateUrl: 'http://another.org/sparql'
      }
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          'sparql': {
            type: 'construct',
            query: constructQuery
          }
        }
      })
      server.inject('/', (res) => {
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
      register: register,
      options: {
        request: request,
        endpointUrl: 'http://example.org/sparql',
      }
    }, (err) => {
      expect(err).to.be.not.ok
      server.route({
        method: 'GET',
        path: '/',
        handler: {
          'sparql': {
            type: 'update',
            query: updateQuery
          }
        }
      })
      server.inject('/', (res) => {
        expect(res.result.method).to.be.equal('POST')
        expect(res.result.url).to.be.equal('http://example.org/sparql')
        expect(res.result.content).to.be.equal(
          'query=' + encodeURIComponent(updateQuery))
        done()
      })
    })
  })

})
