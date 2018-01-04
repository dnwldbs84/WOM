function GameObject(){
  this.position = {
    x : 0 , y : 0
  };
  this.size = {
    width : 0, height : 0
  };
  //change with this.position
  this.center = {
    x : this.position.x + this.size.width/2,
    y : this.position.y + this.size.height/2
  };
};

GameObject.prototype.setPosition = function(x, y){
  this.position.x = x;
  this.position.y = y;
  this.setCenter();
};

GameObject.prototype.setSize = function(w, h){
  this.size.width = w;
  this.size.height = h;
}

GameObject.prototype.setCenter = function(){
  if(this.size.width === 0 || this.size.height === 0){
    console.log('setSize before setCenter');
  }
  this.center.x = this.position.x + this.size.width/2;
  this.center.y = this.position.y + this.size.height/2;
}

module.exports = GameObject;
