import {expect} from 'chai'
import Joi from 'joi'
import {escapeString} from '../src/escaping'
import {SparqlClient} from '../src/index'

describe('hapi-sparql\'s escaping', () => {
  const client = new SparqlClient({log: () => {}}, {})
  const testBind = client.bind.bind(null, '?x', 'x')

  it('escapes string', () => {
    expect(testBind('foo', Joi.string())).to.be.equal('"foo"')
    expect(testBind('foo\n\rbar',
      Joi.string())).to.be.equal('"foo\\n\\rbar"')
    // badly escaped strings
    expect(testBind('"foo\\"',
      Joi.string())).to.be.equal(escapeString('"foo\\"'))
    expect(testBind('"fo\\o"',
      Joi.string())).to.be.equal(escapeString('"fo\\o"'))
    expect(testBind('"""foo"""bar',
      Joi.string())).to.be.equal(escapeString('"""foo"""bar'))
  })

  it('escapes URI', () => {
    expect(testBind('foo', Joi.string().uri())).to.be.equal('<foo>')
    // bad IRIs
    expect(testBind('<foo bar>', Joi.string())).to.be.equal(
      escapeString('<foo bar>'))
    expect(testBind('<f\\oo>', Joi.string())).to.be.equal(
      escapeString('<f\\oo>'))
    expect(testBind('<f[oo>', Joi.string())).to.be.equal(
      escapeString('<f[oo>'))
    expect(testBind('<f{oo>', Joi.string())).to.be.equal(
      escapeString('<f{oo>'))
    expect(testBind('<f^oo>', Joi.string())).to.be.equal(
      escapeString('<f^oo>'))
    expect(testBind('<f>oo>', Joi.string())).to.be.equal(
      escapeString('<f>oo>'))
  })

  it('escapes booleans', () => {
    expect(testBind(true, Joi.number().integer())).to.be.equal('true')
    expect(testBind(false, Joi.number().integer())).to.be.equal('false')
  })

  it('escapes numbers', () => {
    expect(testBind(42, Joi.number().integer())).to.be.equal('42')
    expect(testBind(3.14159265358979,
      Joi.number())).to.be.equal('3.14159265358979')
    expect(testBind(1267.43233E12,
      Joi.number())).to.be.equal('1267432330000000')
    expect(testBind(12.78e-2, Joi.number())).to.be.equal('0.1278')
  })

  it('escapes dates', () => {
    const now = new Date(Date('now'))
    expect(testBind('foo',
      Joi.string().isoDate())).to.be.equal('"foo"^^xsd:dateTime')
    expect(testBind(now,
      Joi.date())).to.be.equal(`"${now.toISOString()}"^^xsd:dateTime`)
  })

  it('can\'t escapes something not handled', () => {
    expect(testBind.bind(null, 'foo', Joi.object())).to.throw()
  })
})
