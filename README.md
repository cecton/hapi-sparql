[![Build Status](https://travis-ci.org/cecton/hapi-sparql.svg?branch=master)](https://travis-ci.org/cecton/hapi-sparql)
[![Code Climate](https://codeclimate.com/github/cecton/hapi-sparql/badges/gpa.svg)](https://codeclimate.com/github/cecton/hapi-sparql)
[![Test Coverage](https://codeclimate.com/github/cecton/hapi-sparql/badges/coverage.svg)](https://codeclimate.com/github/cecton/hapi-sparql/coverage)
[![Issue Count](https://codeclimate.com/github/cecton/hapi-sparql/badges/issue_count.svg)](https://codeclimate.com/github/cecton/hapi-sparql)

# hapi-sparql
A simple Hapi SPARQL connection plugin. It uses
[zazukoians/sparql-http-client](https://github.com/zazukoians/sparql-http-client)
as SPARQL client.

## Synopsis

    import Hapi from 'hapi'
    import request from 'request'
    import SparqlHttp from 'sparql-http-client'
    import util from 'util'

    const graph_iri = 'http://dbpedia.org'
    const server = new Hapi.Server()
    server.connection({ port: 3000 })


    // register Hapi SARQL plugin by providing the request function and the
    // HTTP URL to connect
    server.register({
        register: require('hapi-sparql'),
        options: {
          request: SparqlHttp.requestModuleRequest(request),
          endpointUrl: 'http://dbpedia.org/sparql'
        }
      }, () => {


      // set some routes that only does queries
      server.route([
        {
          method: 'GET',
          path: '/select',
          handler: {
            'sparql': {
              type: 'select',
              query: `SELECT * FROM <${graph_iri}> WHERE {?s ?p ?o}`,
              placeholders: [
                's', 'p', 'o'
              ]
            }
          }
        },
        {
          method: 'GET',
          path: '/construct',
          handler: {
            'sparql': {
              type: 'construct',
              query: 'CONSTRUCT {?s ?p ?o} WHERE {?s ?p ?o}',
              placeholders: [
                's', 'p', 'o'
              ]
            }
          }
        }
      ])


      // access the endpoint from a function handler
      // See also: https://github.com/zazukoians/sparql-http-client
      server.route({
        method: 'GET',
        path: '/custom',
        handler: (request, reply) => {
          const endpoint = request.server.plugins['hapi-sparql'].endpoint
          endpoint.selectQuery(
            `SELECT * FROM <${graph_iri}> WHERE {?s ?p ?o}`, (err, result) => {
              const jsonResult = JSON.parse(result.body)
              request.server.log('info', 'reply: ' +
                util.inspect(jsonResult, {colors: true, depth: null}))
              reply(jsonResult)
            })
        }
      })
    })

    server.start()
