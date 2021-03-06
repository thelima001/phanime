Template.userProfileSummary.created = function() {
	this.isEditing = new ReactiveVar(false);
};

Template.userProfileSummary.onRendered(function() {
	this.fileInput = this.$('<input type="file">');
});

Template.userProfileSummary.events({
	'click #editProfile' : function(event, template) {
		template.isEditing.set(!template.isEditing.get());
	},

	'click #saveProfile' : function(event, template) {
		// Let's save things
		var about = $("#profileAboutInput").val().trim();
		var location = $("#profileLocationInput").val().trim();
		var website = $("#profileWebsiteInput").val().trim();

		var currentProfile = template.data.profile;
		var newProfile = currentProfile;

		Meteor.users.update({_id: Meteor.userId()}, {$set: {'profile.about': about, 'profile.location': location, 'profile.website': website}});
		Notifications.success("Profile changes saved!", "Your profile has been successfully saved");

		// Toggle the isEditing reactive var
		template.isEditing.set(!template.isEditing.get());
	}

});


Template.userProfileSummary.helpers({
	isEditing: function() {
		return Template.instance().isEditing.get();
	}
});
