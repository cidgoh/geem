from django.db import models
from django.contrib.auth.models import User
from django.contrib.postgres.fields import JSONField

# Create your models here.
class Package(models.Model):
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        blank=False,
        null=False,
    )
    contents = JSONField()
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    package_type = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=64, blank=True)
    title = models.CharField(max_length=256, blank=True)
    description = models.TextField()
    license = models.CharField(max_length=256, blank=True)
    version = models.CharField(max_length=256, blank=True)

    def __str__(self):
        return "id:" + str(self.id) + " owner:" + self.owner.username + " type:" + self.package_type
    
