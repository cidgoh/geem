from django.db import models
from django.contrib.auth.models import User
from django.contrib.postgres.fields import JSONField

# Create your models here.
class Package(models.Model):
    DRAFT = 'draft' # Draft and review resources only appear on owner's menu
    REVIEW = 'review'
    RELEASE = 'release' # Release resources appear on everyone's menu if they are shared.
    CURATION_CHOICES = (
        (DRAFT, 'draft'),
        (REVIEW, 'under review'),
        (RELEASE, 'released'),
    )

    owner = models.ForeignKey(
        User,
        related_name='packages',
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    root_name = models.CharField(
        max_length=20,
        #unique=True, Enforce this by code between shared/private, since ontology name can match package if added after package.
        blank=False,
        default="new package"
    )
    version = models.CharField(
        max_length=10,
        blank=True
    )
    ontology = models.BooleanField(default=False) # ontology or user package
    public   = models.BooleanField(default=False) # public or private (owner-only access)
    curation = models.CharField(
        max_length=7,
        choices=CURATION_CHOICES,
        default=DRAFT
    ) 

    contents = JSONField() # Only stores metadata for now.

    def __str__(self):
        owner = self.owner
        if (owner):
            return "id:" + str(self.id) + " owner:" + self.owner.username + " created:" + str(self.created)
        else:
            return "id:" + str(self.id) + " owner:" + "public" + " created:" + str(self.created)
    
