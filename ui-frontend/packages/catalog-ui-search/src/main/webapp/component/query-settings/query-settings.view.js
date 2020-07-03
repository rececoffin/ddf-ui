/**
 * Copyright (c) Codice Foundation
 *
 * This is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details. A copy of the GNU Lesser General Public License
 * is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 *
 **/

const Marionette = require('marionette')
const Backbone = require('backbone')
const _ = require('underscore')
const $ = require('jquery')
const template = require('./query-settings.hbs')
const CustomElements = require('../../js/CustomElements.js')
const DropdownModel = require('../dropdown/dropdown.js')
const QuerySrcView = require('../dropdown/query-src/dropdown.query-src.view.js')
const PropertyView = require('../property/property.view.js')
const Property = require('../property/property.js')
const SortItemCollectionView = require('../sort/sort.view.js')
const Common = require('../../js/Common.js')
const properties = require('../../js/properties.js')
const sourcesInstance = require('../../component/singletons/sources-instance')
const plugin = require('plugins/query-settings')
const user = require('../singletons/user-instance.js')
import * as React from 'react'
import RadioComponent from '../../react-component/input-wrappers/radio'
import { showErrorMessages } from '../../react-component/utils/validation'

module.exports = plugin(
  Marionette.LayoutView.extend({
    template,
    tagName: CustomElements.register('query-settings'),
    modelEvents: {},
    events: {
      'click .editor-edit': 'turnOnEditing',
      'click .editor-cancel': 'cancel',
      'click .editor-save': 'save',
      'click .editor-saveRun': 'run',
    },
    regions: {
      settingsSortField: '.settings-sorting-field',
      spellcheckForm: '.spellcheck-form',
      phoneticsForm: '.phonetics-form',
      settingsSrc: '.settings-src',
      extensions: '.query-extensions',
    },
    ui: {},
    focus() {},
    initialize() {
      this.listenTo(
        this.model,
        'change:sortField change:sortOrder change:sources change:federation',
        Common.safeCallback(this.onBeforeShow)
      )
    },
    onBeforeShow() {
      this.setupSpellcheck()
      this.setupPhonetics()
      this.setupSortFieldDropdown()
      this.setupSrcDropdown()
      this.turnOnEditing()
      this.setupExtensions()
    },
    getExtensions() {},
    setupExtensions() {
      const extensions = this.getExtensions()
      if (extensions !== undefined) {
        this.extensions.show(extensions)
      } else {
        this.extensions.empty()
      }
    },
    handleChangeDetailLevel(model, values) {
      $.each(model.get('enum'), (index, value) => {
        if (values[0] === value.value) {
          this.model.set('detail-level', value)
        }
      })
    },
    onRender() {
      this.setupSrcDropdown()
    },
    setupSortFieldDropdown() {
      this.settingsSortField.show(
        new SortItemCollectionView({
          collection: new Backbone.Collection(this.model.get('sorts')),
          showBestTextOption: true,
        })
      )
    },
    setupSrcDropdown() {
      const sourceIds = sourcesInstance.models.map(src => src.id)
      const defaultSources = this.model.get('sources')
      const validDefaultSources =
        defaultSources && defaultSources.filter(src => sourceIds.includes(src))
      const hasValidDefaultSources =
        validDefaultSources && validDefaultSources.length
      this._srcDropdownModel = new DropdownModel({
        value: validDefaultSources || [],
        federation: hasValidDefaultSources
          ? this.model.get('federation')
          : 'enterprise',
      })
      if (this.getExtensions() !== undefined) {
        return
      }
      this.settingsSrc.show(
        new QuerySrcView({
          model: this._srcDropdownModel,
        })
      )
      this.settingsSrc.currentView.turnOffEditing()
    },
    setupSpellcheck() {
      if (!properties.isSpellcheckEnabled) {
        this.model.set('spellcheck', false)
        return
      }
      const spellcheckView = Marionette.ItemView.extend({
        template: () => (
          <RadioComponent
            value={this.model.get('spellcheck')}
            label="Spellcheck"
            options={[
              {
                label: 'On',
                value: true,
              },
              {
                label: 'Off',
                value: false,
              },
            ]}
            onChange={value => {
              this.model.set('spellcheck', value)
            }}
          />
        ),
      })
      this.spellcheckForm.show(new spellcheckView())
    },
    setupPhonetics() {
      if (!properties.isPhoneticsEnabled) {
        this.model.set('phonetics', false)
        return
      }
      const phoneticsView = Marionette.ItemView.extend({
        template: () => (
          <RadioComponent
            value={this.model.get('phonetics')}
            label="Similar Word Matching"
            options={[
              {
                label: 'On',
                value: true,
              },
              {
                label: 'Off',
                value: false,
              },
            ]}
            onChange={value => {
              this.model.set('phonetics', value)
            }}
          />
        ),
      })
      this.phoneticsForm.show(new phoneticsView())
    },
    turnOffEditing() {
      this.$el.removeClass('is-editing')
      this.regionManager.forEach(region => {
        if (region.currentView && region.currentView.turnOffEditing) {
          region.currentView.turnOffEditing()
        }
      })
    },
    turnOnEditing() {
      this.$el.addClass('is-editing')
      this.regionManager.forEach(region => {
        if (region.currentView && region.currentView.turnOnEditing) {
          region.currentView.turnOnEditing()
        }
      })
      this.focus()
    },
    cancel() {
      this.$el.removeClass('is-editing')
      this.onBeforeShow()
      this.$el.trigger('closeDropdown.' + CustomElements.getNamespace())
    },
    toJSON() {
      let federation = this._srcDropdownModel.get('federation')
      const spellcheck = this.model.get('spellcheck')
      const phonetics = this.model.get('phonetics')
      let sources
      if (federation === 'selected') {
        sources = this._srcDropdownModel.get('value')
        if (sources === undefined || sources.length === 0) {
          federation = 'local'
        }
      }
      const sorts = this.settingsSortField.currentView.collection.toJSON()
      return {
        sources,
        federation,
        sorts,
        'detail-level': undefined,
        spellcheck,
        phonetics,
      }
    },
    saveToModel() {
      this.model.set(this.toJSON())
    },
    getErrorMessages() {
      return []
    },
    save() {
      const errorMessages = this.getErrorMessages()
      if (errorMessages.length !== 0) {
        showErrorMessages(errorMessages)
        return
      }
      this.saveToModel()
      this.cancel()
      this.$el.trigger('closeDropdown.' + CustomElements.getNamespace())
    },
    run() {
      const errorMessages = this.getErrorMessages()
      if (errorMessages.length !== 0) {
        showErrorMessages(errorMessages)
        return
      }
      this.saveToModel()
      this.cancel()
      this.model.startSearch()
      this.$el.trigger('closeDropdown.' + CustomElements.getNamespace())
    },
  })
)
