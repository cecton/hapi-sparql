import Boom from 'boom'
import Joi from 'joi'
import SparqlHttp from 'sparql-http-client'
import {escapeBoolean, escapeDate, escapeString} from './escaping'

const optionsSchema = Joi.object({
  testing: Joi.boolean(),
  request: Joi.func().arity(5).required(),
  endpointUrl: Joi.string().required(),
  updateUrl: Joi.string().default(Joi.ref('endpointUrl'))
})

export class SparqlClient {

  constructor (server, options) {
    this.settings = options
    this._server = server
    this._server.log(['hapi-sparql', 'info'],
      'Initializing connection to Sparsql server...')
    this.endpoint = new SparqlHttp(options)
  }

  escape (value, schema) {
    const tests = schema._tests.map((test) => { return test.name })
    switch (schema._type) {
      case 'string':
        if (tests.indexOf('isoDate') > -1) {
          return `"${value}"^^xsd:dateTime`
        } else if (tests.indexOf('uri') > -1) {
          return `<${value}>`
        } else {
          return escapeString(value)
        }
      case 'date':
        return escapeDate(value)
      case 'boolean':
        return escapeBoolean(value)
      case 'number':
        return String(value)
      default:
        throw new Error(
          'conversion of query argument of type ' +
          ` "${schema._type}" not implemented`)
    }
  }

  bind = (query, key, value, schema) => {
    return query.replace(
      new RegExp(`\\?${key}\\b`, 'g'),
      this.escape(value, schema))
  }

  bindParams = (query, params, schema) => {
    return [query]
      .concat(
        Object.keys(params)
      )
      .reduce((prev, value) => {
        return (
          params[value] === undefined
            ? prev
            : this.bind(prev, value, params[value], Joi.reach(schema, value))
        )
      })
  }

  send = (type, query, callback, queryOptions) => {
    const accept = this.endpoint.types[type].accept
    const {...options} = {accept, ...queryOptions}
    this._server.log(['hapi-sparql', 'debug'],
      'query (' + type + '): ' + query)
    this.endpoint.types[type].operation.call(
      this.endpoint, query, callback, options)
  };

  handler = (route, routeOptions) => {
    return (request, reply) => {
      const {type, query, ...queryOptions} = routeOptions
      if (request.headers.accept !== '*/*') {
        queryOptions.accept = request.headers.accept
      }
      this.send(type,
        this.bindParams(query, request.query, route.settings.validate.query),
        (error, response) => {
          if (error) {
            // NOTE: unhandled HTTP exception, just throw it to get a 500
            throw error
          }
          this._server.log(['hapi-sparql', 'debug'],
            'accept: ' + queryOptions.accept)
          if (response.statusCode >= 300) {
            this._server.log(['hapi-sparql', 'error'],
              'results body:\n' + response.body)
            reply(Boom.create(response.statusCode, response.body))
          } else {
            this._server.log(['hapi-sparql', 'debug'],
              'results body:\n' + response.body)
            reply(response.body)
              .type(response.headers['content-type'])
              .code(response.statusCode)
          }
        },
        queryOptions)
    }
  };

}

exports.register = (server, pluginOptions, next) => {
  optionsSchema.validate(pluginOptions, (err, options) => {
    if (err) {
      return next(err)
    }
    const sparql = new SparqlClient(server, options)
    server.handler('sparql', sparql.handler)
    server.expose('endpoint', sparql.endpoint)
    server.expose('bind', sparql.bind)
    server.expose('bindParams', sparql.bindParams)
    return next()
  })
}

exports.register.attributes = {
  pkg: require('../package.json')
}
