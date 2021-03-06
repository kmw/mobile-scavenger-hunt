from flask import request, current_app

from sqlalchemy.exc import OperationalError

from models import Hunt, Participant, Item, Admin, Setting
from hunt import bcrypt

import copy
import time


def valid_login(admin, email, password):
    return admin and bcrypt.check_password_hash(
        admin.pw_hash, password)


def get_admin(db, email):
    return db.session.query(Admin).filter(Admin.email == email).first()


def get_settings(db, admin_id=None, hunt_id=None, retries=3):
    try:
        if admin_id:
            return db.session.query(Setting) \
                .filter(Setting.admin_id == admin_id) \
                .first()
        elif hunt_id:
            return db.session.query(Setting) \
                .join(Admin).join(Hunt) \
                .filter(Hunt.hunt_id == hunt_id) \
                .first()
    except OperationalError:
        if retries > 0:
            current_app.logger.exception(
                'Problem getting settings from database. Waiting and retrying'
            )
            time.sleep(1)
            db.session.rollback()
            return get_settings(db, admin_id, hunt_id, retries - 1)
        else:
            raise

    return None


def get_items(db, hunt_id):
    return db.session.query(Item).filter(Item.hunt_id == hunt_id).all()


def get_item(db, item_id, hunt_id):
    return db.session.query(Item).filter(
        Item.hunt_id == hunt_id, Item.item_id == item_id).first()


def get_participant(db, email, hunt_id):
    return db.session.query(Participant).filter(
        Participant.email == email, Participant.hunt_id == hunt_id).first()


def get_hunt_domain(db, hunt_id):
    hunt = db.session.query(Hunt).filter(Hunt.hunt_id == hunt_id).first()
    if hunt:
        return hunt.domain
    return None


def get_intended_url(session, hunt_id):
    if 'intended_url' in session:
        return session.pop('intended_url')
    else:
        return '/hunts/{}/items'.format(hunt_id)


def finished_setting(setting):
    return setting and setting.wax_site and setting.login and setting.password


def item_path(hunt_id, item_id):
    return "{}hunts/{}/items/{}".format(request.host_url, hunt_id, item_id)


def validate_participant(db, email, hunt_id, participant_rule):
    if participant_rule == 'by_domain':
        domain = get_hunt_domain(db, hunt_id)
        return domain == email.split('@')[-1], \
            "Only participants with emails on the domain, {}, may participate".format(domain)
    elif participant_rule == 'by_whitelist':
        return get_participant(db, email, hunt_id) is not None, \
            "You are not on the list of allowed participants"
    # anyone can participate
    return True, ''


def initialize_hunt(form, hunt, admin_id, request):
    def new_participant(email):
        p = Participant()
        p.email = email
        return p

    form.populate_obj(hunt)
    hunt.admin_id = admin_id

    # even though this is structured the same way as items
    # (which works), this workaround is necessary to create
    # hunt participants
    hunt.participants = [
        new_participant(v) for k, v in request.form.items()
        if '-email' in k
    ]
    return hunt


def create_new_participant(db, form, hunt_id):
    participant = Participant()
    form.populate_obj(participant)
    participant.registered = True
    participant.hunt_id = hunt_id

    db.session.add(participant)
    db.session.commit()


def participant_registered(db, email, hunt_id):
    return email and get_participant(db, email, hunt_id)


def found_ids_list(state):
    copied_state = copy.deepcopy(state)
    if copied_state.get('hunt_completed'):
        copied_state.pop('hunt_completed')
    return copied_state.keys()


def found_count(state):
    return len(state) - (1 if state.get('hunt_completed') else 0)


def num_items_remaining(state, items):
    return len(items) - len(found_ids_list(state))


def hunt_requirements_completed(state, hunt):
    required_items = frozenset(str(item.item_id) for item in hunt.items if item.required)
    return not (required_items - state.viewkeys()) and found_count(state) >= hunt.num_required
