from django.db import models
from django.contrib.auth.models import User

# Create your models here.
class File(models.Model):
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        blank=False,
        null=False,
    )
    contents = models.TextField()
    public = models.BooleanField()
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return "id:" + str(self.id) + " owner:" + self.owner.username + " public:" + str(self.public)
    
