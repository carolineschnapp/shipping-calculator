/**
 * Module to add a shipping rates calculator to cart page.
 *
 * Copyright (c) 2011-2012 Caroline Schnapp (11heavens.com)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 */

// Adding utility function to Countries object defined in countries.js.
// Some countries use 'province' while others use 'state'.
if (typeof Countries === 'object') {
  Countries.updateProvinceLabel = function(country, provinceLabelElement) {
    if (typeof country === 'string' && Countries[country] && Countries[country].provinces) {
      if (typeof provinceLabelElement !== 'object') {
        provinceLabelElement = document.getElementById('address_province_label');
        if (provinceLabelElement === null) return;
      }
      provinceLabelElement.innerHTML = Countries[country].label;
      var provinceContainer = $(provinceLabelElement).parent();
      var provinceSelect = provinceContainer.find('select');
      provinceContainer.find('.custom-style-select-box-inner').html(provinceSelect.val());
    }
  };
}

// Adding Shopify.Cart.ShippingCalculator object.
if (typeof Shopify.Cart === 'undefined') {
  Shopify.Cart = {}
}
// Creating a module to encapsulate this.
Shopify.Cart.ShippingCalculator = (function() {  
  var _config = {
    submitButton: 'Calculate shipping', 
    submitButtonDisabled: 'Calculating...',
    templateId: 'shipping-calculator-response-template',
    wrapperId: 'wrapper-response',
    customerIsLoggedIn: false,
    moneyFormat: '$ {{amount}}'
  };  
  var _render = function(response) {    
    var template = jQuery('#' + _config.templateId);
    var wrapper = jQuery('#' + _config.wrapperId);      
    if (template.length && wrapper.length) {
      template.tmpl(response).appendTo(wrapper);
      if (typeof Currency !== 'undefined' && typeof Currency.convertAll === 'function') {
        var newCurrency = '';
        if (jQuery('[name=currencies]').size()) {
          newCurrency = jQuery('[name=currencies]').val();
        }
        else if (jQuery('#currencies span.selected').size()) {
          newCurrency = jQuery('#currencies span.selected').attr('data-currency');
        }
        if (newCurrency !== '') {
          Currency.convertAll(shopCurrency, newCurrency, '#wrapper-response span.money, #estimated-shipping em span.money');
        }
      }
    }
  };  
  var _enableButtons = function() {
    jQuery('.get-rates').removeAttr('disabled').removeClass('disabled').val(_config.submitButton).html(_config.submitButton);
  };
  var _disableButtons = function() {
    jQuery('.get-rates').val(_config.submitButtonDisabled).html(_config.submitButtonDisabled).attr('disabled','disabled').addClass('disabled');
  };
  // ---------------------------------------------------------
  // GET cart/shipping_rates.js returns the cart in JSON.
  // ---------------------------------------------------------
  var _getCartShippingRatesForDestination = function(shipping_address) {
    var params = {
      type: 'GET',
      url: '/cart/shipping_rates.json',
      data: jQuery.param({'shipping_address': shipping_address}),
      dataType: 'json',
      success: function(response) { 
        rates = response.shipping_rates
        _onCartShippingRatesUpdate(rates, shipping_address);
      },
      error: function(XMLHttpRequest, textStatus) {
        _onError(XMLHttpRequest, textStatus);
      }
    }
    jQuery.ajax(params);
  };
  var _fullMessagesFromErrors = function(errors) {
    var fullMessages = [];
    jQuery.each(errors, function(attribute, messages) {
      jQuery.each(messages, function(index, message) {
        fullMessages.push(attribute + ' ' + message);
      });
    });
    return fullMessages
  };
  var _onError = function(XMLHttpRequest, textStatus) {
    jQuery('#estimated-shipping').hide();
    jQuery('#estimated-shipping em').empty();
    // Re-enable calculate shipping buttons.
    _enableButtons();
    // Formatting error message.
    var feedback = '';
    var data = eval('(' + XMLHttpRequest.responseText + ')');
    if (!!data.message) {
      feedback = data.message + '(' + data.status  + '): ' + data.description;
    } 
    else {
      feedback = 'Error : ' + _fullMessagesFromErrors(data).join('; ');
    }    
    if (feedback === 'Error : country is not supported.') feedback = 'We do not ship to this destination.';
    // Update calculator.
    _render( { rates: [], errorFeedback: feedback, success: false } );
    jQuery('#' + _config.wrapperId).show();
  };  
  var _onCartShippingRatesUpdate = function(rates, shipping_address) {
    // Re-enable calculate shipping buttons.
    _enableButtons();
    // Formatting shipping address.
    var readable_address = '';
    if (shipping_address.zip) readable_address += shipping_address.zip + ', ';
    if (shipping_address.province) readable_address += shipping_address.province + ', ';
    readable_address += shipping_address.country;
    // Show estimated shipping.
    jQuery('#estimated-shipping em').html(_formatRate(rates[0].price));
    // Show rates and feedback.
    _render( { rates: rates, address: readable_address, success:true } );
    // Revealing response.
    jQuery('#' + _config.wrapperId + ', #estimated-shipping').fadeIn();
  };
  var _formatRate = function(cents) {
    if (typeof cents == 'string') cents = cents.replace('.','');
    var value = '';
    var patt = /\{\{\s*(\w+)\s*\}\}/;
    var formatString = _config.moneyFormat;
    function addCommas(moneyString) {
      return moneyString.replace(/(\d+)(\d{3}[\.,]?)/,'$1,$2');
    }
    function floatToString(numeric, decimals) {  
      var amount = numeric.toFixed(decimals).toString();  
      if(amount.match(/^\.\d+/)) {return "0"+amount; }
      else { return amount; }
    }
    switch(formatString.match(patt)[1]) {
      case 'amount':
        value = addCommas(floatToString(cents/100.0, 2));
        break;
      case 'amount_no_decimals':
        value = addCommas(floatToString(cents/100.0, 0));
        break;
      case 'amount_with_comma_separator':
        value = floatToString(cents/100.0, 2).replace(/\./, ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        value = addCommas(floatToString(cents/100.0, 0)).replace(/\./, ',');
        break;
    }
    return formatString.replace(patt, value);        
  };  
  _init = function() {
    // Initialize observer on shipping address.
    new Shopify.CountryProvinceSelector('address_country', 'address_province', { hideElement: 'address_province_container' } );
    // Updating province label.
    var countriesSelect = jQuery('#address_country');
    var addressProvinceLabelEl = jQuery('#address_province_label').get(0);
    if (typeof Countries !== 'undefined') {
      Countries.updateProvinceLabel(countriesSelect.val(),addressProvinceLabelEl);
      countriesSelect.change(function() {
        Countries.updateProvinceLabel(countriesSelect.val(),addressProvinceLabelEl);
      });
    }
    // When either of the calculator buttons is clicked, get rates.
    jQuery('.get-rates').click(function() {
      // Disabling all buttons.
      _disableButtons();
      // Hiding response.
      jQuery('#' + _config.wrapperId).empty().hide();
      // Reading shipping address for submission.
      var shippingAddress = {};
      shippingAddress.zip = jQuery('#address_zip').val() || '';
      shippingAddress.country = jQuery('#address_country').val() || '';
      shippingAddress.province = jQuery('#address_province').val() || '';
      _getCartShippingRatesForDestination(shippingAddress);
    });
    // We don't wait for customer to click if we know his/her address.
    if (_config.customerIsLoggedIn) {
      jQuery('.get-rates:eq(0)').trigger('click');
    }
  };
  return {
    show: function(params) {
        // Configuration
        params = params || {};
        // Merging with defaults.
        jQuery.extend(_config, params);
        // Action
        jQuery(function() {
          _init();
        });
    },    
    getConfig: function() {
      return _config;
    },
    formatRate: function(cents) {
      return _formatRate(cents);
    }
  }  
})();