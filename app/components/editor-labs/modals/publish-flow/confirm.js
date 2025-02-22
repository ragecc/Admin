import Component from '@glimmer/component';
import moment from 'moment';
import {htmlSafe} from '@ember/template';
import {isArray} from '@ember/array';
import {isServerUnreachableError} from 'ghost-admin/services/ajax';
import {inject as service} from '@ember/service';
import {task} from 'ember-concurrency';
import {tracked} from '@glimmer/tracking';

function isString(str) {
    return toString.call(str) === '[object String]';
}

export default class PublishFlowOptions extends Component {
    @service settings;

    @tracked errorMessage;

    // store any derived state from PublishOptions on creation so the copy
    // doesn't change whilst the post is saving
    willEmail = this.args.publishOptions.willEmail;
    willPublish = this.args.publishOptions.willPublish;

    get confirmButtonText() {
        const publishOptions = this.args.publishOptions;

        let buttonText = '';

        if (publishOptions.willPublish && publishOptions.willEmail) {
            buttonText = 'Publish & send';
        } else if (publishOptions.willOnlyEmail) {
            buttonText = 'Send email';
        } else {
            buttonText = `Publish ${this.args.publishOptions.post.displayName}`;
        }

        if (this.args.publishOptions.isScheduled) {
            const scheduleMoment = moment.tz(this.args.publishOptions.scheduledAtUTC, this.settings.get('timezone'));
            buttonText += `, on ${scheduleMoment.format('MMMM Do')}`;
        } else {
            buttonText += ', right now';
        }

        return buttonText;
    }

    @task({drop: true})
    *confirmTask() {
        this.errorMessage = null;

        try {
            yield this.args.saveTask.perform();
        } catch (e) {
            if (e === undefined && this.publishOptions.post.errors.length !== 0) {
                // validation error
                const validationError = this.args.publishOptions.post.errors.messages[0];
                this.errorMessage = `Validation failed: ${validationError}`;
                return false;
            }

            let errorMessage = '';

            if (isServerUnreachableError(e)) {
                errorMessage = 'Unable to connect, please check your internet connection and try again.';
            } else if (e && isString(e)) {
                errorMessage = e;
            } else if (e && isArray(e)) {
                // This is here because validation errors are returned as an array
                // TODO: remove this once validations are fixed
                errorMessage = e[0];
            } else if (e?.payload?.errors?.[0].message) {
                errorMessage = e.payload.errors[0].message;
            } else {
                errorMessage = 'Unknown Error';
            }

            this.errorMessage = htmlSafe(errorMessage);
            return false;
        }
    }
}
