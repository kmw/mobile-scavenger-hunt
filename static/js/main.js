console.log('loading main.js');

$(document).ready(function() {
  var itemCount = $('.hunt-items').length;
  var participantCount = 0;

  var huntId = function() {
    return $('form[hunt_id]').attr('hunt_id');
  };


  var updateHunt = function(data) {
    $.ajax({
      url: '/edit_hunt/' + huntId(),
      method: 'POST',
      data: data
    })
    .success(function() {
      console.log('updated hunt');
      return true;
    })
    .error(function() {
      console.log('fail update hunt');
    });
  };

  // make hunt name updateable on click
  var oldName = $('input[name=name]').val();
  $('input[name=name]').on('blur', function() {
    if (huntId()) {
      var newName = $(this).val();
      if (newName != oldName) {
        if (updateHunt({'name': newName})) {
          oldName = newName;
        }
      }
    }
  });

  // show checkmarks for selected participant rule
  var participant_rule_el = $('input[name=participant_rule][checked=on]');
  if (participant_rule_el) {
    $(participant_rule_el).siblings().show();
  }

  // toggle for whether or not an item is required
  // parent needed to help detect dynamically added content
  var $parent = $('#items-group .table.table-condensed');
  $($parent).on("change", ".hunt-items", function(e) {
    // if value is in target, it's been set to "on". toggling removes value.
    if ('value' in e.currentTarget) {
      $($('input[name=all_required]')[1]).prop('checked', true);
    }
  });

  // create input name for item required that works with wtforms
  var itemRequiredName = function(index) {
    return "items-" + index + "-required";
  };

  // make new item checkbox
  var tdCheckbox = function(index, checked) {
    if (checked) {
      return "<td><input type='checkbox' checked='on' class='hunt-items' name='" + itemRequiredName(index) + "'> Required</td>";
    }
    return "<td><input type='checkbox' class='hunt-items' name='" + itemRequiredName(index) + "'> Required</td>";
  };

  // since jquery wrap doesn't seem to work
  var tdItem = function(nameOfItem) {
    return "<td class='item-required'>" + nameOfItem + "</td>";
  };

  // create input name property that works with wtforms
  var itemName = function(itemCount) {
    return 'items-' + itemCount + '-name';
  };

  // gives admin something to delete items
  var itemDelete = function() {
    return '<td class="item-delete"><span class="glyphicon glyphicon-remove"></span></td>';
  };

  // add tr to item table
  var addItemRow = function(itemCount, fieldValue) {
    var checked = $("input[name=all_required]").prop('checked');
    var row = "<tr>" + tdItem(fieldValue) + tdCheckbox(itemCount, checked) + itemDelete() + "</tr>";
    $('#items-table tbody').append(row);
  };

  // toggle if all items are required for success
  $("input[name=all_required]").change(function() {
    var allItemsRequired = $(this).prop('checked');
    if (allItemsRequired) {
      $('input.hunt-items').prop('checked', true);
      $('#num-items-group').hide('slow');
    }
    else {
      $('#num-items-group').show('slow');
    }
  });

  // update item requirement when checkmark changes
  $('input[checked][item_id]').on('change', function() {
     var item_id = $(this).attr('item_id');
    var data = {
      'hunt_id': huntId(),
      'required': $(this).prop('checked')
    };
    updateItem(data, item_id);
  });

  // helper for addInput
  var addNewField = function(fieldType, name, fieldValue) {
    var newField = $('<input type="hidden">').attr('name', name)
                                             .attr('value', fieldValue);
    $('#' + fieldType + '-group .input-group').append(newField);
  };

  var validEmail = function(email) {
    var validEmailRegex = /[\w-]+@([\w-]+\.)+[\w-]+/;
    return validEmailRegex.test(email);
  };


  // add item or participant hidden input field that works with wtforms
  var addInput = function(fieldType, count) {
    var fieldName = itemName(count);
    var fieldInput = $('input#' + fieldType + '-template');
    var fieldValue = fieldInput.val();

    if (fieldValue) {
      // find smarter way to do this
      if (fieldType == 'items' || fieldType == 'ajax-items') {
        addItemRow(itemCount, fieldValue);
        addNewField('items', 'items-' + itemCount + "-name", fieldValue);

        itemCount = incrementCount('items', count);
      }
      else {
        if (validEmail(fieldValue)) {
          addParticipantRow(fieldValue, true);
          addNewField(
            'participants', 'participants-' + participantCount + '-email', fieldValue);

          participantCount = incrementCount('participants', count);
        }
        else {
          $('#participant-error').show('slow');
        }
      }
      fieldInput.val('');
    }
  };

  // add input on enter
  var addInputByKeydown = function(event, type, count) {
    if (event.keyCode == 13) {
      event.preventDefault();
      addInput(type, count);
    }
  };

  // updates count and makes item/participant table appear with the first added row
  var incrementCount = function(countType, count) {
    if (count < 1) {
      $('#' + countType + '-table').show('slide', {'direction': 'up'}, 'fast');
    }
    count += 1;
    return count;
  };

  // updates count and makes item/participant table disappear on the last item deleted
  var decrementCount = function(countType, count) {
    count -= 1;
    if (count < 1) {
      $('#' + countType + '-table').hide('slow');
    }
    return count;
  };


  // helper for addInput that displays each added participant email
  var addParticipantRow = function(email, registered) {
    var emailTd = "<td>" + email + "</td>";
    var checkmark;
    var listRow = "<tr>" + emailTd + "<td></td></tr>";
    $('#participants-table').append(listRow);
  };

  var addParticipant = function(data) {
      $.ajax({
        url: '/new_participant',
        method: 'POST',
        data: data
      })
      .success(function() {
        console.log('success new part.');
        $('#participants-table').append(
          "<tr><td>" + data.email + "</td><td></td></tr>");
      })
      .error(function() {
        console.log('fail new part.');
      });
  };

  // add participant to list for later submission via button
  $("#add-participant").on("click", (function() {
    if (huntId()) {
      var email = $('#participants-template').val();
      if (validEmail(email)) {
        addParticipant({'email': email, 'hunt_id': huntId()});
      }
    }
    else {
      addInput('participants', participantCount);
    }
  }));

  // add participant to list for later submission via "enter" on keyboard
  $('#participants-template').keydown(function(event) {
    $('#participant-error').hide('slow');
    addInputByKeydown(event, 'participants', participantCount);
  });

  // add item to table for later submission via button
  $("#add-item").on("click", (function() {
    addInput('items', itemCount);
  }));

  // add item to table for later submission via "enter" on keyboard
  $('input#items-template').keydown(function(event) {
    addInputByKeydown(event, 'items', itemCount);
  });

  // ajax helper for adding items
  var addItem = function(data) {
    $.ajax({
      url: '/new_item',
      method: 'POST',
      data: data
    })
    .success(function() {
      console.log('item!');
      $('#items-table').append(
        "<tr><td>" + data.name + "</td><td><input type='checkbox' hunt-id={{hunt.hunt_id}} checked={{item.required}} class='hunt-items'> Required</td>" + itemDelete() + "</tr>");
    })
    .error(function() {
      console.log('fail new item');
    });
  };

  // add item via ajax on enter
  $('input#ajax-items-template').keydown(function(event) {
    if (event.keyCode == 13) {
      var fieldInput = $('input#ajax-items-template'); //hm
      var fieldValue = fieldInput.val();
      var hunt_id = huntId();
      addItem({'name': fieldValue, 'hunt_id': hunt_id});
    }
  });

  // add new item from hunt page
  $('#ajax-add-item').on('click', function(e) {
    var data = {
      'hunt_id': huntId(),
      'name': $('input#ajax-items-template').val(),
      'required': $("input[name=all_required]").prop('checked')
    };
    addItem(data);
  });

  // helper to update item attributes via ajax
  var updateItem = function(data, item_id) {
    $.ajax({
      url: '/edit_item/' + item_id,
      method: 'POST',
      data: data
    })
    .success(function() {
      console.log('success');
    })
    .error(function() {
      console.log('fail');
    });
  };

  // clicking on item name allows for editting
  $('.item-name').on('click', function(e) {
    var itemName = $(this).find('span').html();
    $(this).find('span').hide();
    $(this).find('input').val(itemName).show().focus();
  });

  // update item name when clicking outside of input
  $('.item-name input').on('blur', function() {
    var typedName = $(this).val();
    var oldName = $(this).siblings('span').html();
    $(this).hide();
    $(this).siblings('span').show().html(typedName);

    var item_id = $(this).parent().parent().attr('item_id');

    if (typedName != oldName) {
      var data = {'name': typedName};
      updateItem(data, item_id);
    }
  });

  // remove item from list and delete on backend
  $('#items-table tbody').on('click', 'td.item-delete', function() {
    // if on the edit page, delete the item on the backend
    if (huntId()) {
      var item_id = $(this).parents('tr').attr('item_id');
      $.ajax({
        url: '/delete_item/' + item_id,
        method: 'POST'
      })
      .success(function() {
        console.log('success');
      })
      .error(function() {
        console.log('fail');
      });
    }
    $(this).parents('tr').remove();
    itemCount = decrementCount('items', itemCount);
  });

  // time formatter
  $('.uglytime').each(function(index, e) {
    var currentTime = $(e).html();
    var prettyTime = moment(currentTime).format("MM-DD-YYYY");
    $(e).text(prettyTime);
  });

  // update welcome message when clicking outside of textarea
  var oldWelcome = $('textarea[name=welcome_message]').val();
  $('textarea[name=welcome_message]').blur(function() {
    currentWelcome = $('textarea[name=welcome_message]').val();
    if (oldWelcome != currentWelcome && huntId()) {
      updateHunt({'welcome_message': currentWelcome});
      oldWelcome = currentWelcome;
    }
  });

  // update congrulations message when clicking outside of textarea
  var oldCongratulations = $('textarea[name=congratulations_message').html();
  $('textarea[name=congratulations_message]').blur(function() {
    currentCongratulations = $(this).val();
    if (oldCongratulations != currentCongratulations && huntId()) {
      updateHunt({'congratulations_message': currentCongratulations});
      oldCongratulations = currentCongratulations;
    }
  });

  // various events for updating ui upon participant rule selection
  $('#participant-rules .panel-rect').on({
    click: function(e) {
      $(this).css('opacity', 1).siblings().css('opacity', 0.7);
      $('.glyphicon-ok').hide('slow');
      $($(this).find('.glyphicon-ok')).show();

      var selectedRule = $(this).find($('input[name=participant_rule]'));
      if (huntId()) {
        // updateHunt({'participant_rule': selectedRule.val()});
        // i don't know if i want them to be able to update this
      }
      else {
        selectedRule.prop('checked', 'on');
        if (selectedRule.val() == 'by_whitelist') {
          $('#participants-group').show('slide', {'direction': 'up'}, 'slow');
        }
        else {
          $('#participants-group').hide('slide', {'direction': 'up'}, 'slow');
        }
      }
    },
    mouseenter: function() {
      $(this).addClass('panel-rect-hover');
    },
    mouseleave: function() {
      $(this).removeClass('panel-rect-hover');
    }
  });
});