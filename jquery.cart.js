/**
 * Module to add a shipping rates calculator to cart page.
 *
 * Copyright (c) 2011 Caroline Schnapp (11heavens.com)
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
    }
  };
}

// Adding Shopify.Cart.ShippingCalculator object.
if (typeof Shopify.Cart === 'undefined') {
  Shopify.Cart = {}
}
Shopify.Cart.ShippingCalculator = (function() {  
  var _config = {
    submitButton: 'Calculate shipping', 
    submitButtonDisabled: 'Calculating...',
    templateId: 'shipping-calculator-response-template',
    wrapperId: 'wrapper-response',
    customerIsLoggedIn: false
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
          Currency.convertAll(shopCurrency, newCurrency, '#wrapper-response span.money');
        }
      }
    }
  };  
  var _enableButtons = function() {
   jQuery('.get_rates').removeAttr('disabled').removeClass('disabled').val(_config.submitButton);
  };
  var _disableButtons = function() {
    jQuery('.get_rates').val(_config.submitButtonDisabled).attr('disabled','disabled').addClass('disabled');
  };
  Shopify.onError = function(XMLHttpRequest, textStatus) {
    // Re-enable calculate shipping buttons.
    _enableButtons();
    // Formatting error message.
    var feedback = '';
    var data = eval('(' + XMLHttpRequest.responseText + ')');
    if (!!data.message) {
      feedback = data.message + '(' + data.status  + '): ' + data.description;
    } 
    else {
      feedback = 'Error : ' + Shopify.fullMessagesFromErrors(data).join('; ');
    }    
    if (feedback === 'Error : country is not supported.') feedback = 'We do not ship to this destination.';
    // Update calculator.
    _render( { rates: [], errorFeedback: feedback, success: false } );
    jQuery('#' + _config.wrapperId).show();
  };  
  Shopify.onCartShippingRatesUpdate = function(rates, shipping_address) {
    // Re-enable calculate shipping buttons.
    _enableButtons();
    // Formatting shipping address.
    var readable_address = '';
    if (shipping_address.zip) readable_address += shipping_address.zip + ', ';
    if (shipping_address.province) readable_address += shipping_address.province + ', ';
    readable_address += shipping_address.country;
    // Show rates and feedback.
    _render( { rates: rates, address: readable_address, success:true } );
    // Revealing response.
    jQuery('#' + _config.wrapperId).fadeIn();
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
    jQuery('.get_rates').click(function() {
      // Disabling all buttons.
      _disableButtons();
      // Hiding response.
      jQuery('#' + _config.wrapperId).empty().hide();
      // Reading shipping address for submission.
      var shippingAddress = {};
      shippingAddress.zip = jQuery('#address_zip').val() || '';
      shippingAddress.country = jQuery('#address_country').val() || '';
      shippingAddress.province = jQuery('#address_province').val() || '';
      Shopify.getCartShippingRatesForDestination(shippingAddress);
    });
    // We don't wait for customer to click if we know his/her address.
    if (_config.customerIsLoggedIn) {
        jQuery('.get_rates:eq(0)').trigger('click');
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
    }    
  }  
})();