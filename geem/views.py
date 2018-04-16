from django.shortcuts import render
from django.http import HttpResponse
import json

# Create your views here.
def index(request):
    return render(request, 'geem/index.html', context={})

def portal(request):
    return render(request, 'geem/portal.html', context={})

def form(request):
    return render(request, 'geem/form.html', context={})

def modal_lookup(request):
    return render(request, 'geem/templates/modal_lookup.html', context={})

def resource_summary_form(request):
    return render(request, 'geem/templates/resource_summary_form.html', context={})

def test_epi(request):
    data = json.load(open('geem/static/geem/data/shared_packages/test.epi.json'))
    return HttpResponse(json.dumps(data), content_type='application/json')

def genepio_merged(request):
    data = json.load(open('geem/static/geem/data/ontology/genepio-merged.json'))
    return HttpResponse(json.dumps(data), content_type='application/json')

def foodon_merged(request):
    data = json.load(open('geem/static/geem/data/ontology/foodon-merged.json'))
    return HttpResponse(json.dumps(data), content_type='application/json')
