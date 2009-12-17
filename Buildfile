config :components,
  :required => %w(tiki tiki/platform/classic tiki/system bespin),
  :dynamic_required => [],
  :test_required => [:core_test],
  :test_debug => [],
  :use_modules => true,
  :use_loader => true,
  :factory_format => :function

config :editor,
  :required => %w(tiki tiki/platform/classic tiki/system bespin),
  :dynamic_required => [],
  :test_required => [:core_test],
  :test_debug => [],
  :use_modules => true,
  :use_loader => true,
  :factory_format => :function

proxy '/server/', :to => 'localhost:8080', :url => "/"
