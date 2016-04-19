import Boom from 'boom'
import Joi from 'joi'
import SparqlHttp from 'sparql-http-client'

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

  escape_string (string) {
    return '"' + string.replace(/[\\"']/g, '\\$&') + '"'
  }

  bind (query, key, value) {
    return query.replace(
      new RegExp(`\\?${key}\\b`, 'g'),
      this.escape_string(value))
  }

  bindParams (query, params, placeholders) {
    return [query]
      .concat(
        placeholders !== undefined ? placeholders : Object.keys(params)
      )
      .reduce((prev, value) => {
        return params[value] === undefined
          ? prev
          : this.bind(prev, value, params[value])
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
      const {type, query, placeholders, ...queryOptions} = routeOptions
      if (request.headers.accept !== '*/*') {
        queryOptions.accept = request.headers.accept
      }
      this.send(type,
        this.bindParams(query, request.query, placeholders || []),
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
    return next()
  })
}

exports.register.attributes = {
  pkg: require('../package.json')
}
